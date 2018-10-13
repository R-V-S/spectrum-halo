const {dialog} = require('electron').remote
const fs = require('fs')
const path = require('path')

const oscilloscopeCanvas = document.getElementById('oscilloscope')
oscilloscopeCanvas.width = window.innerWidth
oscilloscopeCanvas.height = window.innerHeight
const osCtx = oscilloscopeCanvas.getContext('2d')

let animationFrame

const audioCtx = new window.AudioContext()
let audioSource
let audioBuffer
let audioPosition = 0

const analyser = audioCtx.createAnalyser()
analyser.fftSize = 1024
const analyserData = new Uint8Array(analyser.fftSize)
analyser.connect(audioCtx.destination)


const openFileButton = document.getElementById('openFileButton')
const playButton = document.getElementById('playButton')
const pauseButton = document.getElementById('pauseButton')

openFileButton.addEventListener('click', function() {
  dialog.showOpenDialog({properties: ['openFile']}, loadFile)
})

playButton.addEventListener('click', function() {
  playAudio()
})

pauseButton.addEventListener('click', function() {
  cancelAnimationFrame(animationFrame)
  audioPosition = audioCtx.currentTime
  if (audioSource) {
    audioSource.stop()
  }
  audioSource = null
})

function playAudio() {

  if (audioSource) {
    audioSource.stop()
  }

  audioSource = audioCtx.createBufferSource()
  audioSource.buffer = audioBuffer
  audioSource.loop = true
  audioSource.connect(analyser)

  drawOscilloscopes(osCtx)

  audioSource.start(0, audioPosition)
}

function loadFile(filenames) {
  const extension = path.extname(filenames[0])
  switch(extension) {
    case '.wav':
    case '.mp3':
      fs.readFile(filenames[0], processAudioFile)
  }
}

function processAudioFile(err, data) {
  audioCtx.decodeAudioData(data.buffer, (buffer) => {
    audioBuffer = buffer
    audioPosition = 0

    playAudio()

  },
  (e) => {
    throw(e)
  })
}

function drawOscilloscopes() {
  animationFrame = requestAnimationFrame(drawOscilloscopes)
  // console.log('%canimationFrame', 'color:green;', animationFrame)

  analyser.getByteTimeDomainData(analyserData)

  drawBackground(osCtx)
  drawCircularOscilloscope(oscilloscopeCanvas, osCtx)
  // drawLineOscilloscope(osCtx)
}

function drawBackground(ctx) {
  ctx.fillStyle = 'hsla(200,50%,15%, 0.5)'
  ctx.fillRect(0, 0, oscilloscopeCanvas.width,oscilloscopeCanvas.height)
}

function drawLineOscilloscope(ctx) {
  ctx.lineWidth = 1
  ctx.strokeStyle = 'hsla(200,50%,80%,0.8)'

  ctx.beginPath()
  ctx.moveTo(0, oscilloscopeCanvas.height / 2)
  for (let i = 0; i < analyser.fftSize; i++) {
    let normalizedMagnitude = (analyserData[i] / 128)
    let y = normalizedMagnitude * (oscilloscopeCanvas.height / 2)
    let x = (i / analyser.fftSize) * oscilloscopeCanvas.width

    ctx.lineTo(x, y)
  }

  ctx.stroke()
}

function drawCircularOscilloscope(canvas, ctx) {
  let gradient;
  const bound = Math.min(canvas.width, canvas.height)
  const c = {
    w: canvas.width,
    h: canvas.height,
    wh: canvas.width/2,
    hh: canvas.height/2,
    r: bound/2,
    rh: bound/4
  }

  ctx.lineWidth = 2


  ctx.beginPath()

  for (let i = 0; i < analyser.fftSize; i++) {
    let normalizedMagnitude = analyserData[i] / 128
    if (i < 20 || i > analyser.fftSize - 20) {
      let strength = (20-Math.min(i, analyser.fftSize - i)) / 40
      normalizedMagnitude = ((analyserData[i] / 128) * (1-strength)) + ((analyserData[analyser.fftSize-i] / 128) * (strength))
    }
    let linearPosition = i/(analyser.fftSize-1)
    let radii = {
        inner: bound / 2
      , outer: bound / 4
    }
    let adjustedCircleBoundary = (radii.inner + (normalizedMagnitude * radii.outer) ) / 2
    let x = {
        base: c.wh
      , positionOnUnitCircle: (Math.sin(linearPosition * Math.PI*2))
    }
    let y = {
        base: c.hh
      , positionOnUnitCircle: (Math.cos(linearPosition * Math.PI*2))
    }
    x.finalValue = x.base + (x.positionOnUnitCircle * adjustedCircleBoundary)
    y.finalValue = y.base + (y.positionOnUnitCircle * adjustedCircleBoundary)
    // let y = (oscilloscopeCanvas.height/2) + (Math.cos(( i/analyser.fftSize) * Math.PI*2) * bound/3 ) + (Math.cos(offset*1000* Math.PI*2))

    gradient = ctx.createRadialGradient(c.wh, c.hh, c.r, c.wh, c.hh, 0)
    let second = (Date.now() / 1000).toFixed(0)[9]/10
    let hue = ((second*80) + (Math.pow(normalizedMagnitude,2) * 360 || 0)) % 360
    let sat = 80 + (normalizedMagnitude * 20 || 0)
    gradient.addColorStop(0, `hsla(${hue},${sat}%,65%, 0.3)`)
    gradient.addColorStop(0.2, `hsla(${hue},${sat}%,60%, 0.3)`)
    gradient.addColorStop(0.5, `hsla(${hue},${sat}%,50%, 0.3)`)
    gradient.addColorStop(1, `hsla(${hue},${sat}%,40%, 0.3)`)

    ctx.lineTo(x.finalValue, y.finalValue)
  }
  // ctx.stroke()
  ctx.fillStyle = gradient
  ctx.fill()

}
