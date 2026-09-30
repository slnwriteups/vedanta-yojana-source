Pod::Spec.new do |s|
  s.name           = 'VYQuickLook'
  s.version        = '1.0.0'
  s.summary        = 'Opens a local document in the iOS Quick Look preview.'
  s.description    = 'Local Expo module: presents QLPreviewController for a file URL.'
  s.license        = 'MIT'
  s.author         = 'Vedanta Yojana'
  s.homepage       = 'https://vedantayojana.org'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
