import CoreMotion
import Flutter

/// Device tilt, used to give the 3D scenes a little parallax. Reads orientation
/// only, which needs no permission, and runs only while a scene is listening.
final class Motion: NSObject, FlutterStreamHandler {
  private let manager = CMMotionManager()

  func onListen(withArguments arguments: Any?, eventSink events: @escaping FlutterEventSink) -> FlutterError? {
    guard manager.isDeviceMotionAvailable else { return nil }
    manager.deviceMotionUpdateInterval = 1.0 / 30.0
    manager.startDeviceMotionUpdates(to: .main) { motion, _ in
      guard let attitude = motion?.attitude else { return }
      events(["pitch": attitude.pitch, "roll": attitude.roll])
    }
    return nil
  }

  func onCancel(withArguments arguments: Any?) -> FlutterError? {
    manager.stopDeviceMotionUpdates()
    return nil
  }
}
