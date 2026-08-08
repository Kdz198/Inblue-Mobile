package com.inbluemb

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlin.concurrent.thread

class RealtimePcmAudioModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  private var recorder: AudioRecord? = null
  private var recordingThread: Thread? = null
  @Volatile private var isRecording = false

  override fun getName(): String = "RealtimePcmAudio"

  @ReactMethod
  fun start(promise: Promise) {
    if (isRecording) {
      promise.resolve(null)
      return
    }

    if (reactContext.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      promise.reject("E_PERMISSION", "Microphone permission has not been granted.")
      return
    }

    val sampleRate = 16000
    val channelConfig = AudioFormat.CHANNEL_IN_MONO
    val audioFormat = AudioFormat.ENCODING_PCM_16BIT
    val minBufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat)

    if (minBufferSize <= 0) {
      promise.reject("E_AUDIO_RECORD", "Unable to initialize microphone buffer.")
      return
    }

    try {
      val chunkSize = maxOf(minBufferSize, sampleRate / 10 * 2)
      val audioRecord = AudioRecord(
        MediaRecorder.AudioSource.VOICE_RECOGNITION,
        sampleRate,
        channelConfig,
        audioFormat,
        chunkSize * 2
      )

      audioRecord.startRecording()
      recorder = audioRecord
      isRecording = true

      recordingThread = thread(name = "RealtimePcmAudio") {
        val buffer = ByteArray(chunkSize)

        while (isRecording) {
          val bytesRead = audioRecord.read(buffer, 0, buffer.size)
          if (bytesRead > 0) {
            emitChunk(buffer, bytesRead)
          }
        }
      }

      promise.resolve(null)
    } catch (error: Throwable) {
      stopInternal()
      promise.reject("E_AUDIO_RECORD", error.message, error)
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    stopInternal()
    promise.resolve(null)
  }

  @ReactMethod
  fun addListener(eventName: String) = Unit

  @ReactMethod
  fun removeListeners(count: Int) = Unit

  private fun emitChunk(buffer: ByteArray, bytesRead: Int) {
    val payload = Base64.encodeToString(buffer.copyOf(bytesRead), Base64.NO_WRAP)
    val event = Arguments.createMap().apply {
      putString("pcmBase64", payload)
    }
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("RealtimePcmAudioChunk", event)
  }

  private fun emitError(message: String) {
    val event = Arguments.createMap().apply {
      putString("message", message)
    }
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("RealtimePcmAudioError", event)
  }

  private fun stopInternal() {
    isRecording = false

    try {
      recordingThread?.join(300)
    } catch (error: InterruptedException) {
      Thread.currentThread().interrupt()
      emitError(error.message ?: "Audio recording thread interrupted.")
    }

    recordingThread = null

    try {
      recorder?.stop()
    } catch (_: Throwable) {}

    try {
      recorder?.release()
    } catch (_: Throwable) {}

    recorder = null
  }
}
