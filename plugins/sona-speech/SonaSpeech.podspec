require 'json'
package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name = 'SonaSpeech'
  s.version = package['version']
  s.summary = package['description']
  s.license = 'MIT'
  s.homepage = 'https://speaksona.com'
  s.author = 'Sona'
  s.source = { :git => 'https://github.com/traviswardrop13/SaaS.git', :tag => s.version.to_s }
  s.source_files = 'ios/Sources/SonaSpeechPlugin/**/*.{swift,h,m}'
  s.ios.deployment_target = '14.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.1'
end
