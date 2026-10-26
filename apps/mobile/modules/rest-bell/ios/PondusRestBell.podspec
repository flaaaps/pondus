# Local Expo module (apps/mobile/modules/rest-bell), autolinked from the app's `modules/` folder.
Pod::Spec.new do |s|
  s.name           = 'PondusRestBell'
  s.version        = '1.0.0'
  s.summary        = 'Rest-end bell through headphones, also in the background'
  s.description    = 'Keeps a silent, mixable playback session alive during a rest and rings the bell at its end when headphones are connected.'
  s.author         = 'Pondus'
  s.homepage       = 'https://github.com/flaaaps/pondus'
  s.license        = { :type => 'UNLICENSED' }
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AVFoundation', 'UserNotifications'

  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
