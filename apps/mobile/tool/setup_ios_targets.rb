# One-time project setup: adds the Live Activity extension, native sources,
# entitlements, privacy manifest, and StoreKit test configuration to Runner.xcodeproj.
# Safe to run again; it skips anything already present.
#   GEM_PATH=~/.gem/ruby/2.6.0:$(gem env gempath) ruby tool/setup_ios_targets.rb
require "xcodeproj"

TEAM = "LNL8GARN23"
EXTENSION = "LexaLiveActivity"
EXTENSION_BUNDLE_ID = "com.vaibhavsg.lexa.liveactivity"

Dir.chdir(File.join(__dir__, "..", "ios"))
project = Xcodeproj::Project.open("Runner.xcodeproj")
runner = project.targets.find { |t| t.name == "Runner" }
tests = project.targets.find { |t| t.name == "RunnerTests" }

def group_at(parent, name, path)
  parent.children.find { |c| c.respond_to?(:name) && (c.display_name == name) } || parent.new_group(name, path)
end

def add_source(group, target, filename)
  ref = group.files.find { |f| f.path == filename } || group.new_reference(filename)
  unless target.source_build_phase.files_references.include?(ref)
    target.source_build_phase.add_file_reference(ref)
  end
  ref
end

def add_resource(group, target, filename)
  ref = group.files.find { |f| f.path == filename } || group.new_reference(filename)
  unless target.resources_build_phase.files_references.include?(ref)
    target.resources_build_phase.add_file_reference(ref)
  end
  ref
end

runner_group = project.main_group.children.find { |c| c.display_name == "Runner" }

# ---- Native sources ----------------------------------------------------------
native_group = group_at(runner_group, "Native", "Native")
Dir["Runner/Native/*.swift"].sort.each do |file|
  add_source(native_group, runner, File.basename(file))
end

shared_group = group_at(project.main_group, "Shared", "Shared")
shared_ref = shared_group.files.find { |f| f.path == "LexaActivityAttributes.swift" } ||
             shared_group.new_reference("LexaActivityAttributes.swift")
unless runner.source_build_phase.files_references.include?(shared_ref)
  runner.source_build_phase.add_file_reference(shared_ref)
end

add_resource(runner_group, runner, "PrivacyInfo.xcprivacy")
unless runner_group.files.any? { |f| f.path == "Runner.entitlements" }
  runner_group.new_reference("Runner.entitlements")
end

runner.build_configurations.each do |config|
  config.build_settings["CODE_SIGN_ENTITLEMENTS"] = "Runner/Runner.entitlements"
  config.build_settings["DEVELOPMENT_TEAM"] = TEAM
  config.build_settings["CODE_SIGN_STYLE"] = "Automatic"
  config.build_settings["TARGETED_DEVICE_FAMILY"] = "1,2"
end

# ---- Live Activity extension -------------------------------------------------
extension = project.targets.find { |t| t.name == EXTENSION }
unless extension
  extension = project.new_target(:app_extension, EXTENSION, :ios, "17.0", nil, :swift)
end

extension_group = group_at(project.main_group, EXTENSION, EXTENSION)
add_source(extension_group, extension, "LexaLiveActivityBundle.swift")
add_source(extension_group, extension, "LexaLiveActivity.swift")
add_resource(extension_group, extension, "Assets.xcassets")
unless extension_group.files.any? { |f| f.path == "Info.plist" }
  extension_group.new_reference("Info.plist")
end
unless extension.source_build_phase.files_references.include?(shared_ref)
  extension.source_build_phase.add_file_reference(shared_ref)
end

extension.build_configurations.each do |config|
  config.build_settings.merge!(
    "PRODUCT_BUNDLE_IDENTIFIER" => EXTENSION_BUNDLE_ID,
    "PRODUCT_NAME" => "$(TARGET_NAME)",
    "INFOPLIST_FILE" => "#{EXTENSION}/Info.plist",
    "GENERATE_INFOPLIST_FILE" => "NO",
    "DEVELOPMENT_TEAM" => TEAM,
    "CODE_SIGN_STYLE" => "Automatic",
    "IPHONEOS_DEPLOYMENT_TARGET" => "17.0",
    "SWIFT_VERSION" => "5.0",
    "TARGETED_DEVICE_FAMILY" => "1,2",
    "SKIP_INSTALL" => "YES",
    "SWIFT_EMIT_LOC_STRINGS" => "YES",
    "LD_RUNPATH_SEARCH_PATHS" => ["$(inherited)", "@executable_path/Frameworks", "@executable_path/../../Frameworks"],
  )
end

# Profile builds exist on Runner; the extension needs a matching configuration.
unless extension.build_configurations.any? { |c| c.name == "Profile" }
  release = extension.build_configurations.find { |c| c.name == "Release" }
  profile = project.new(Xcodeproj::Project::Object::XCBuildConfiguration)
  profile.name = "Profile"
  profile.build_settings = release.build_settings.dup
  extension.build_configuration_list.build_configurations << profile
end

# Same base settings as the app, so the version and simulator rules stay in step.
extension.build_configurations.each do |config|
  runner_config = runner.build_configurations.find { |c| c.name == config.name }
  config.base_configuration_reference = runner_config.base_configuration_reference
end

# ---- Embed the extension in the app, ahead of Flutter's "Thin Binary" script,
# which is what avoids Xcode's build-cycle error for Flutter apps with extensions.
unless runner.dependencies.any? { |d| d.target == extension }
  runner.add_dependency(extension)
end

embed = runner.copy_files_build_phases.find { |p| p.name == "Embed Foundation Extensions" }
unless embed
  embed = runner.new_copy_files_build_phase("Embed Foundation Extensions")
  embed.symbol_dst_subfolder_spec = :plug_ins
end
unless embed.files_references.include?(extension.product_reference)
  build_file = embed.add_file_reference(extension.product_reference)
  build_file.settings = { "ATTRIBUTES" => ["RemoveHeadersOnCopy"] }
end
thin = runner.build_phases.find { |p| p.display_name == "Thin Binary" }
runner.build_phases.delete(embed)
runner.build_phases.insert(runner.build_phases.index(thin), embed)

# ---- Purchase tests -----------------------------------------------------------
tests_group = project.main_group.children.find { |c| c.display_name == "RunnerTests" }
add_source(tests_group, tests, "StoreTests.swift")
storekit = project.main_group.files.find { |f| f.path == "Lexa.storekit" } || project.main_group.new_reference("Lexa.storekit")
unless tests.resources_build_phase.files_references.include?(storekit)
  tests.resources_build_phase.add_file_reference(storekit)
end
tests.build_configurations.each { |c| c.build_settings["DEVELOPMENT_TEAM"] = TEAM }

project.save

# ---- Use the StoreKit configuration when running from Xcode --------------------
scheme_path = "Runner.xcodeproj/xcshareddata/xcschemes/Runner.xcscheme"
scheme = File.read(scheme_path)
unless scheme.include?("StoreKitConfigurationFileReference")
  reference = "      <StoreKitConfigurationFileReference\n         identifier = \"../Lexa.storekit\">\n      </StoreKitConfigurationFileReference>\n"
  scheme = scheme.sub("   </LaunchAction>", "#{reference}   </LaunchAction>")
  File.write(scheme_path, scheme)
end

puts "Targets: #{project.targets.map(&:name).join(', ')}"
puts "Runner phases: #{runner.build_phases.map(&:display_name).join(' > ')}"
