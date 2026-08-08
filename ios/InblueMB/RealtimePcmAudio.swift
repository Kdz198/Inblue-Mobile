import AVFoundation
import React

@objc(RealtimePcmAudio)
class RealtimePcmAudio: RCTEventEmitter {
  private let sampleRate: Double = 16000
  private let engine = AVAudioEngine()
  private var converter: AVAudioConverter?
  private var outputFormat: AVAudioFormat?
  private var hasListeners = false
  private var isRecording = false

  override static func requiresMainQueueSetup() -> Bool {
    false
  }

  override func supportedEvents() -> [String]! {
    ["RealtimePcmAudioChunk", "RealtimePcmAudioError"]
  }

  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

  @objc(start:rejecter:)
  func start(resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    if isRecording {
      resolve(nil)
      return
    }

    do {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.playAndRecord, mode: .measurement, options: [.defaultToSpeaker, .allowBluetooth])
      try session.setPreferredSampleRate(sampleRate)
      try session.setActive(true)

      let inputNode = engine.inputNode
      let inputFormat = inputNode.outputFormat(forBus: 0)

      guard let targetFormat = AVAudioFormat(
        commonFormat: .pcmFormatInt16,
        sampleRate: sampleRate,
        channels: 1,
        interleaved: true
      ) else {
        reject("E_AUDIO_FORMAT", "Unable to create PCM output format.", nil)
        return
      }

      guard let audioConverter = AVAudioConverter(from: inputFormat, to: targetFormat) else {
        reject("E_AUDIO_CONVERTER", "Unable to create PCM audio converter.", nil)
        return
      }

      converter = audioConverter
      outputFormat = targetFormat

      inputNode.removeTap(onBus: 0)
      inputNode.installTap(onBus: 0, bufferSize: 4096, format: inputFormat) { [weak self] buffer, _ in
        self?.emitConvertedBuffer(buffer)
      }

      engine.prepare()
      try engine.start()
      isRecording = true
      resolve(nil)
    } catch {
      stopInternal()
      reject("E_AUDIO_RECORD", error.localizedDescription, error)
    }
  }

  @objc(stop:rejecter:)
  func stop(resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    stopInternal()
    resolve(nil)
  }

  private func emitConvertedBuffer(_ inputBuffer: AVAudioPCMBuffer) {
    guard hasListeners, let converter = converter, let outputFormat = outputFormat else {
      return
    }

    let ratio = outputFormat.sampleRate / inputBuffer.format.sampleRate
    let frameCapacity = AVAudioFrameCount(Double(inputBuffer.frameLength) * ratio) + 1

    guard let outputBuffer = AVAudioPCMBuffer(pcmFormat: outputFormat, frameCapacity: frameCapacity) else {
      emitError("Unable to allocate PCM output buffer.")
      return
    }

    var consumedInput = false
    let inputBlock: AVAudioConverterInputBlock = { _, outStatus in
      if consumedInput {
        outStatus.pointee = .noDataNow
        return nil
      }

      consumedInput = true
      outStatus.pointee = .haveData
      return inputBuffer
    }

    var conversionError: NSError?
    converter.convert(to: outputBuffer, error: &conversionError, withInputFrom: inputBlock)

    if let conversionError = conversionError {
      emitError(conversionError.localizedDescription)
      return
    }

    let audioBuffer = outputBuffer.audioBufferList.pointee.mBuffers
    guard let dataPointer = audioBuffer.mData, audioBuffer.mDataByteSize > 0 else {
      return
    }

    let data = Data(bytes: dataPointer, count: Int(audioBuffer.mDataByteSize))
    sendEvent(withName: "RealtimePcmAudioChunk", body: ["pcmBase64": data.base64EncodedString()])
  }

  private func emitError(_ message: String) {
    guard hasListeners else {
      return
    }

    sendEvent(withName: "RealtimePcmAudioError", body: ["message": message])
  }

  private func stopInternal() {
    if engine.isRunning {
      engine.inputNode.removeTap(onBus: 0)
      engine.stop()
    }

    converter = nil
    outputFormat = nil
    isRecording = false

    do {
      try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    } catch {
      emitError(error.localizedDescription)
    }
  }
}
