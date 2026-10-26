import AVFoundation
import ExpoModulesCore
import UserNotifications

/// Rings the rest-end bell through headphones, also while Pondus is in the background or the iPhone
/// is locked.
///
/// iOS suspends a backgrounded app within seconds, and a suspended app cannot play sound. With
/// `UIBackgroundModes: audio` it keeps running only while its audio session is active *and* it is
/// playing. So while a rest is armed (and for a short linger time after it, so the next rest started
/// from the Live Activity can be armed too) this module plays a silent loop on a `.playback` session
/// with `.mixWithOthers`: Spotify or a podcast keeps playing and stays the "Now Playing" app, the
/// silent switch is ignored (only relevant with headphones anyway), and the app keeps running. At
/// `endsAt` a wall-clock timer plays the bell over whatever else is playing. With `duck` the other
/// audio is turned down for the length of the bell: the session is re-activated with `.duckOthers`
/// just before it, and deactivated with `.notifyOthersOnDeactivation` (the only way iOS lifts the
/// ducking) and started again right after it.
///
/// iOS does not let an app *start* audio from the background (`AVAudioSession.ErrorCode
/// .cannotStartPlaying`), so the session has to be started while Pondus is in the foreground and kept
/// alive from there. Everything that can fail here fails towards the fallback: the JS side always
/// schedules the "Pause vorbei" notification a few seconds after `endsAt`, and this module removes
/// it only once the bell actually started playing.
///
/// All state lives on one serial queue; the async functions, timers and notification observers all
/// hop onto it.
public class RestBellModule: Module {
  private struct Armed {
    let endsAtMs: Double
    let notificationId: String?
    let duck: Bool
  }

  /// A bell more than this late (app was suspended, e.g. during a phone call) is not played: the
  /// fallback notification is due by then.
  private static let lateToleranceMs: Double = 1500
  private static let bellResource = "rest-bell"
  private static let bellExtension = "wav"
  /// iOS fades other audio down over a few hundred ms; the bell starts once that is mostly done.
  private static let duckLeadTime: TimeInterval = 0.35
  /// Other audio comes back up this long after the bell has finished.
  private static let duckTail: TimeInterval = 0.4

  private let queue = DispatchQueue(label: "app.pondus.rest-bell", qos: .userInteractive)
  private var keepAlive: AVAudioPlayer?
  private var bell: AVAudioPlayer?
  private var armed: Armed?
  private var bellTimer: DispatchSourceTimer?
  private var lingerTimer: DispatchSourceTimer?
  private var duckTimer: DispatchSourceTimer?
  /// The session currently runs with `.duckOthers`.
  private var ducking = false
  /// How long the session stays alive after a bell or a skipped rest, from the last `arm` call.
  private var lingerMs: Double = 0
  private var bellVolume: Float = 1
  private var observers: [NSObjectProtocol] = []

  public func definition() -> ModuleDefinition {
    Name("PondusRestBell")

    Events("onBell", "onRouteChange")

    OnCreate {
      self.observeSession()
    }

    OnDestroy {
      self.observers.forEach { NotificationCenter.default.removeObserver($0) }
      self.observers = []
      self.queue.async { self.releaseSession() }
    }

    /// The bell file is in the app bundle (copied there by the expo-notifications `sounds` option).
    Function("isAvailable") { () -> Bool in
      Self.bellURL() != nil
    }

    Function("headphonesConnected") { () -> Bool in
      Self.headphonesConnected()
    }

    /// Schedules the bell for `endsAtMs` (Unix ms, same clock as JS `Date.now()`), replacing any
    /// earlier one. `notificationId` is the fallback notification to remove once the bell plays.
    /// `duck` turns other audio (music, podcasts) down while the bell plays.
    /// Returns "armed" or why not: "no-headphones", "missing-sound", "too-late", "session-failed".
    AsyncFunction("arm") { (endsAtMs: Double, volume: Double, duck: Bool, notificationId: String?, lingerMs: Double) -> String in
      self.arm(endsAtMs: endsAtMs, volume: volume, duck: duck, notificationId: notificationId, lingerMs: lingerMs)
    }
    .runOnQueue(queue)

    /// Cancels a scheduled bell (rest skipped or paused). The session lingers, so a rest started from
    /// the Live Activity shortly after can still be armed.
    AsyncFunction("disarm") {
      self.cancelBell()
      self.startLinger()
    }
    .runOnQueue(queue)

    /// Cancels the bell and ends the session right away (feature switched off).
    AsyncFunction("release") {
      self.releaseSession()
    }
    .runOnQueue(queue)
  }

  // MARK: - Arming and firing

  private func arm(endsAtMs: Double, volume: Double, duck: Bool, notificationId: String?, lingerMs: Double) -> String {
    cancelBell()
    if ducking { stopDucking() }
    self.lingerMs = max(0, lingerMs)
    bellVolume = Float(min(1, max(0, volume)))
    var isArmed = false
    // Whatever goes wrong, a running session must not outlive its linger time.
    defer { if !isArmed { startLinger() } }
    guard let url = Self.bellURL() else { return "missing-sound" }
    guard Self.headphonesConnected() else { return "no-headphones" }
    // A rest that is (almost) over gets the notification only; arming would just race it.
    guard endsAtMs - Self.nowMs() > 500 else { return "too-late" }
    do {
      try ensureSession()
      if bell == nil || bell?.url != url {
        bell = try AVAudioPlayer(contentsOf: url)
      }
      bell?.prepareToPlay()
    } catch {
      return "session-failed"
    }
    isArmed = true
    cancelLinger()
    armed = Armed(endsAtMs: endsAtMs, notificationId: notificationId, duck: duck)
    let timer = DispatchSource.makeTimerSource(queue: queue)
    // Wall-clock deadline, so a changed system time or a suspended stretch cannot shift it.
    timer.schedule(wallDeadline: Self.wallTime(ms: endsAtMs), leeway: .milliseconds(20))
    timer.setEventHandler { [weak self] in self?.fire() }
    timer.resume()
    bellTimer = timer
    return "armed"
  }

  private func fire() {
    bellTimer?.cancel()
    bellTimer = nil
    guard let due = armed else { return }
    armed = nil
    defer { startLinger() }

    let lateBy = Self.nowMs() - due.endsAtMs
    if lateBy > Self.lateToleranceMs {
      emitBell(due, outcome: "late")
      return
    }
    // Checked again here: headphones taken off during the rest must not ring through the speaker.
    guard Self.headphonesConnected() else {
      emitBell(due, outcome: "no-headphones")
      return
    }
    guard let bell = bell else {
      emitBell(due, outcome: "failed")
      return
    }
    // After an interruption the session may be inactive; reactivating only works if iOS lets us.
    if keepAlive?.isPlaying != true { try? ensureSession() }
    let lead = due.duck && startDucking() ? Self.duckLeadTime : 0
    bell.currentTime = 0
    bell.volume = bellVolume
    let started = lead > 0 ? bell.play(atTime: bell.deviceCurrentTime + lead) : bell.play()
    if started {
      // Only now is the bell certain, so only now does the fallback notification go.
      if let id = due.notificationId {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [id])
      }
      emitBell(due, outcome: "played")
      if ducking { scheduleUnduck(after: lead + bell.duration + Self.duckTail) }
    } else {
      emitBell(due, outcome: "failed")
      if ducking { stopDucking() }
    }
  }

  // MARK: - Ducking

  /// Turns other audio down. Returns false if iOS refuses; the bell then plays without ducking.
  private func startDucking() -> Bool {
    let session = AVAudioSession.sharedInstance()
    do {
      try session.setCategory(.playback, mode: .default, options: [.mixWithOthers, .duckOthers])
      // Ducking applies on activation. The session is already active (silent loop); activating it
      // again with the new options is what turns the others down. Device test: REST_BELL.md, 18.
      try session.setActive(true)
      ducking = true
      return true
    } catch {
      try? session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
      return false
    }
  }

  private func scheduleUnduck(after seconds: TimeInterval) {
    duckTimer?.cancel()
    let timer = DispatchSource.makeTimerSource(queue: queue)
    timer.schedule(deadline: .now() + .milliseconds(Int(seconds * 1000)))
    timer.setEventHandler { [weak self] in self?.stopDucking() }
    timer.resume()
    duckTimer = timer
  }

  /// Brings other audio back up. iOS lifts ducking only when the ducking session deactivates, so the
  /// silent loop pauses, the session goes inactive with `.notifyOthersOnDeactivation` and starts again
  /// at once. The app is still running at that point, which is what iOS requires to start audio. If
  /// it refuses anyway, the session ends: the next rest falls back to the notification until one is
  /// started in the app again.
  private func stopDucking() {
    duckTimer?.cancel()
    duckTimer = nil
    guard ducking else { return }
    ducking = false
    let session = AVAudioSession.sharedInstance()
    bell?.stop()
    keepAlive?.pause()
    try? session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
    try? session.setActive(false, options: .notifyOthersOnDeactivation)
    do {
      try ensureSession()
    } catch {
      releaseSession()
    }
  }

  private func emitBell(_ due: Armed, outcome: String) {
    sendEvent("onBell", ["endsAt": due.endsAtMs, "outcome": outcome])
  }

  private func cancelBell() {
    bellTimer?.cancel()
    bellTimer = nil
    armed = nil
  }

  // MARK: - Session

  /// Activates the mixable playback session and starts the silent keep-alive loop.
  private func ensureSession() throws {
    let session = AVAudioSession.sharedInstance()
    let options: AVAudioSession.CategoryOptions = ducking ? [.mixWithOthers, .duckOthers] : [.mixWithOthers]
    if session.category != .playback || session.categoryOptions != options {
      try session.setCategory(.playback, mode: .default, options: options)
    }
    try session.setActive(true)
    if keepAlive == nil {
      let player = try AVAudioPlayer(data: Self.silentWav())
      player.numberOfLoops = -1
      player.prepareToPlay()
      keepAlive = player
    }
    if keepAlive?.isPlaying != true, keepAlive?.play() != true {
      throw NSError(domain: "PondusRestBell", code: 1, userInfo: [NSLocalizedDescriptionKey: "keep-alive did not start"])
    }
  }

  /// Ends the session after the linger time; the bell itself is never cut off.
  private func startLinger() {
    cancelLinger()
    guard keepAlive != nil, armed == nil else { return }
    let bellLeftMs = (bell?.isPlaying == true) ? ((bell?.duration ?? 0) - (bell?.currentTime ?? 0)) * 1000 + 300 : 0
    let delayMs = max(lingerMs, bellLeftMs)
    let timer = DispatchSource.makeTimerSource(queue: queue)
    timer.schedule(deadline: .now() + .milliseconds(Int(delayMs)))
    timer.setEventHandler { [weak self] in self?.releaseSession() }
    timer.resume()
    lingerTimer = timer
  }

  private func cancelLinger() {
    lingerTimer?.cancel()
    lingerTimer = nil
  }

  private func releaseSession() {
    cancelBell()
    cancelLinger()
    duckTimer?.cancel()
    duckTimer = nil
    ducking = false
    keepAlive?.stop()
    keepAlive = nil
    bell?.stop()
    let session = AVAudioSession.sharedInstance()
    // Lets Spotify & co. know they may undo any ducking; harmless with a mixable session.
    try? session.setActive(false, options: .notifyOthersOnDeactivation)
    // Back to the default category, so nothing else in the app plays through the silent switch.
    try? session.setCategory(.soloAmbient)
  }

  private func observeSession() {
    let center = NotificationCenter.default
    observers.append(center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: nil) { [weak self] note in
      guard let self = self,
            let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
            AVAudioSession.InterruptionType(rawValue: raw) == .ended else { return }
      // A phone call or Siri ended. The session is silent and mixable, so resuming never disturbs
      // other audio. If iOS refuses (app was suspended meanwhile), the notification takes over.
      self.queue.async {
        guard self.keepAlive != nil else { return }
        try? self.ensureSession()
      }
    })
    observers.append(center.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: nil) { [weak self] note in
      guard let self = self,
            let raw = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
            let reason = AVAudioSession.RouteChangeReason(rawValue: raw),
            reason == .newDeviceAvailable || reason == .oldDeviceUnavailable else { return }
      self.queue.async {
        // Some players pause when the old output goes away; keep the silent loop running so the app
        // stays alive and can ring once headphones are back.
        if let keepAlive = self.keepAlive, !keepAlive.isPlaying { keepAlive.play() }
        self.sendEvent("onRouteChange", ["headphonesConnected": Self.headphonesConnected()])
      }
    })
    observers.append(center.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification, object: nil, queue: nil) { [weak self] _ in
      guard let self = self else { return }
      // All audio objects are invalid after a media services reset; rebuild what was running.
      self.queue.async {
        let wasRunning = self.keepAlive != nil
        self.keepAlive = nil
        self.bell = nil
        guard wasRunning else { return }
        try? self.ensureSession()
        if let url = Self.bellURL() { self.bell = try? AVAudioPlayer(contentsOf: url) }
      }
    })
  }

  // MARK: - Helpers

  private static func bellURL() -> URL? {
    Bundle.main.url(forResource: bellResource, withExtension: bellExtension)
  }

  /// Outputs that are (almost always) worn: wired, Lightning/USB-C, Bluetooth (AirPods report A2DP
  /// for playback, HFP during calls, LE for LE Audio). Bluetooth speakers look the same to iOS and
  /// count too. AirPlay, CarPlay, HDMI and the built-in speaker do not.
  static func headphonesConnected() -> Bool {
    let worn: Set<AVAudioSession.Port> = [.headphones, .bluetoothA2DP, .bluetoothLE, .bluetoothHFP, .usbAudio]
    return AVAudioSession.sharedInstance().currentRoute.outputs.contains { worn.contains($0.portType) }
  }

  private static func nowMs() -> Double {
    Date().timeIntervalSince1970 * 1000
  }

  private static func wallTime(ms: Double) -> DispatchWallTime {
    let seconds = floor(ms / 1000)
    let nanos = (ms - seconds * 1000) * 1_000_000
    return DispatchWallTime(timespec: timespec(tv_sec: Int(seconds), tv_nsec: Int(nanos)))
  }

  /// Half a second of digital silence as a WAV in memory (8 kHz, 16-bit mono), looped forever.
  private static func silentWav() -> Data {
    let rate: UInt32 = 8000
    let dataBytes = rate // 0.5 s * 2 bytes per sample
    var d = Data()
    func u32(_ v: UInt32) { withUnsafeBytes(of: v.littleEndian) { d.append(contentsOf: $0) } }
    func u16(_ v: UInt16) { withUnsafeBytes(of: v.littleEndian) { d.append(contentsOf: $0) } }
    d.append(contentsOf: Array("RIFF".utf8)); u32(36 + dataBytes)
    d.append(contentsOf: Array("WAVE".utf8))
    d.append(contentsOf: Array("fmt ".utf8)); u32(16); u16(1); u16(1); u32(rate); u32(rate * 2); u16(2); u16(16)
    d.append(contentsOf: Array("data".utf8)); u32(dataBytes)
    d.append(Data(count: Int(dataBytes)))
    return d
  }
}
