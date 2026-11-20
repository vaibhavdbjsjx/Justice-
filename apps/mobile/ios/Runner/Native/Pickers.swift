import PDFKit
import PhotosUI
import UIKit
import UniformTypeIdentifiers
import VisionKit

/// System pickers for bringing in a document. These run out of process, so they
/// need no photo library permission. Each returns a copy of the file in temporary
/// storage as ["path", "name", "mimeType", "size"], or nil if cancelled.
final class Pickers: NSObject {
  static let shared = Pickers()

  typealias Completion = ([String: Any]?) -> Void
  private var completion: Completion?

  /// Most hosts limit request bodies, and a phone photo holds far more detail than
  /// reading a document needs.
  private static let maxImageDimension: CGFloat = 2600
  private static let imageQuality: CGFloat = 0.82

  var canScan: Bool { VNDocumentCameraViewController.isSupported }

  private var presenter: UIViewController? {
    var top = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap(\.windows)
      .first { $0.isKeyWindow }?
      .rootViewController
    while let presented = top?.presentedViewController { top = presented }
    return top
  }

  func pickDocument(completion: @escaping Completion) {
    self.completion = completion
    let picker = UIDocumentPickerViewController(
      forOpeningContentTypes: [.pdf, .png, .jpeg, .webP, .heic],
      asCopy: true
    )
    picker.delegate = self
    presenter?.present(picker, animated: true)
  }

  func pickPhoto(completion: @escaping Completion) {
    self.completion = completion
    var configuration = PHPickerConfiguration()
    configuration.filter = .images
    configuration.selectionLimit = 1
    let picker = PHPickerViewController(configuration: configuration)
    picker.delegate = self
    presenter?.present(picker, animated: true)
  }

  func scan(completion: @escaping Completion) {
    guard canScan else {
      completion(nil)
      return
    }
    self.completion = completion
    let scanner = VNDocumentCameraViewController()
    scanner.delegate = self
    presenter?.present(scanner, animated: true)
  }

  private func finish(_ result: [String: Any]?) {
    completion?(result)
    completion = nil
  }

  private func temporaryURL(name: String) -> URL {
    let directory = FileManager.default.temporaryDirectory
      .appendingPathComponent("lexa-picks", isDirectory: true)
    try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    return directory.appendingPathComponent("\(UUID().uuidString)-\(name)")
  }

  private func describe(url: URL, name: String, mimeType: String) -> [String: Any] {
    let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
    return ["path": url.path, "name": name, "mimeType": mimeType, "size": size]
  }

  private func storeImage(_ image: UIImage, name: String) -> [String: Any]? {
    let largest = max(image.size.width, image.size.height)
    let scale = min(1, Self.maxImageDimension / max(largest, 1))
    let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
    let format = UIGraphicsImageRendererFormat.default()
    format.scale = 1
    let rendered = UIGraphicsImageRenderer(size: size, format: format).image { _ in
      image.draw(in: CGRect(origin: .zero, size: size))
    }
    guard let data = rendered.jpegData(compressionQuality: Self.imageQuality) else { return nil }
    let filename = "\((name as NSString).deletingPathExtension).jpg"
    let url = temporaryURL(name: filename)
    guard (try? data.write(to: url)) != nil else { return nil }
    return describe(url: url, name: filename, mimeType: "image/jpeg")
  }
}

extension Pickers: UIDocumentPickerDelegate {
  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    guard let url = urls.first else { return finish(nil) }
    let name = url.lastPathComponent
    let type = UTType(filenameExtension: url.pathExtension)

    if type?.conforms(to: .pdf) == true {
      let copy = temporaryURL(name: name)
      guard (try? FileManager.default.copyItem(at: url, to: copy)) != nil else { return finish(nil) }
      return finish(describe(url: copy, name: name, mimeType: "application/pdf"))
    }
    guard let image = UIImage(contentsOfFile: url.path) else { return finish(nil) }
    finish(storeImage(image, name: name))
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    finish(nil)
  }
}

extension Pickers: PHPickerViewControllerDelegate {
  func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
    picker.dismiss(animated: true)
    guard let provider = results.first?.itemProvider, provider.canLoadObject(ofClass: UIImage.self) else {
      return finish(nil)
    }
    let name = provider.suggestedName ?? "Photo"
    provider.loadObject(ofClass: UIImage.self) { [weak self] object, _ in
      DispatchQueue.main.async {
        guard let self, let image = object as? UIImage else {
          self?.finish(nil)
          return
        }
        self.finish(self.storeImage(image, name: name))
      }
    }
  }
}

extension Pickers: VNDocumentCameraViewControllerDelegate {
  func documentCameraViewController(
    _ controller: VNDocumentCameraViewController,
    didFinishWith scan: VNDocumentCameraScan
  ) {
    controller.dismiss(animated: true)
    let document = PDFDocument()
    for index in 0..<scan.pageCount {
      if let page = PDFPage(image: downscaled(scan.imageOfPage(at: index))) {
        document.insert(page, at: document.pageCount)
      }
    }
    let name = "Scanned document.pdf"
    let url = temporaryURL(name: name)
    guard document.write(to: url) else { return finish(nil) }
    finish(describe(url: url, name: name, mimeType: "application/pdf"))
  }

  func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
    controller.dismiss(animated: true)
    finish(nil)
  }

  func documentCameraViewController(
    _ controller: VNDocumentCameraViewController,
    didFailWithError error: Error
  ) {
    controller.dismiss(animated: true)
    finish(nil)
  }

  private func downscaled(_ image: UIImage) -> UIImage {
    let largest = max(image.size.width, image.size.height)
    guard largest > Self.maxImageDimension else { return image }
    let scale = Self.maxImageDimension / largest
    let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
    let format = UIGraphicsImageRendererFormat.default()
    format.scale = 1
    return UIGraphicsImageRenderer(size: size, format: format).image { _ in
      image.draw(in: CGRect(origin: .zero, size: size))
    }
  }
}
