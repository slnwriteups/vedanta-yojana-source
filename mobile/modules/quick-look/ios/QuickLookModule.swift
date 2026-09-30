import ExpoModulesCore
import QuickLook

/**
 * Presents iOS's own Quick Look document preview (the viewer Files and
 * Mail use) for a local file: page through, pinch-zoom, and its share
 * button still offers "Open in Adobe Acrobat" when that's installed.
 * iOS has no equivalent of Android's ACTION_VIEW "open in a PDF viewer",
 * and expo-sharing only offers the share sheet.
 */
public class QuickLookModule: Module {
  // QLPreviewController holds its data source weakly, so keep it alive
  // for as long as the preview is on screen.
  private var dataSource: PreviewDataSource?

  public func definition() -> ModuleDefinition {
    Name("VYQuickLook")

    AsyncFunction("previewAsync") { (uri: URL, promise: Promise) in
      guard QLPreviewController.canPreview(uri as NSURL) else {
        promise.reject("ERR_QUICK_LOOK_UNSUPPORTED", "This file can't be previewed.")
        return
      }
      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        promise.reject("ERR_QUICK_LOOK_NO_VIEW", "There is no screen to present the preview from.")
        return
      }
      let source = PreviewDataSource(url: uri) { [weak self] in
        self?.dataSource = nil
      }
      self.dataSource = source
      let controller = QLPreviewController()
      controller.dataSource = source
      controller.delegate = source
      presenter.present(controller, animated: true) {
        promise.resolve(nil)
      }
    }.runOnQueue(.main)
  }
}

private final class PreviewDataSource: NSObject, QLPreviewControllerDataSource, QLPreviewControllerDelegate {
  private let url: URL
  private let onDismiss: () -> Void

  init(url: URL, onDismiss: @escaping () -> Void) {
    self.url = url
    self.onDismiss = onDismiss
  }

  func numberOfPreviewItems(in controller: QLPreviewController) -> Int {
    1
  }

  func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
    url as NSURL
  }

  func previewControllerDidDismiss(_ controller: QLPreviewController) {
    onDismiss()
  }
}
