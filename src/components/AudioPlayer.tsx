'use client';
import React, { useEffect, useState, useRef } from 'react';


const AudioSyncPlayer = ({ audioUrls }) => {
  const [audioContext, setAudioContext] = useState(null);
  const [sources, setSources] = useState([]);
  const [gainNodes, setGainNodes] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [metadata, setMetadata] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mutedTracks, setMutedTracks] = useState([]);
  const [compressionParams, setCompressionParams] = useState({
    threshold: -24,
    knee: 30,
    ratio: 12,
    attack: 0.003,
    release: 0.25,
  });

  const intervalRef = useRef(null);
  const canvasRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const animationFrameRef = useRef(null);
  const compressorRef = useRef(null);

  useEffect(() => {
    if (audioContext) {
      const loadAudio = async (context, url) => {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        return context.decodeAudioData(arrayBuffer);
      };

      const setupAudio = async (context, urls) => {
        const audioBuffers = await Promise.all(urls.map(url => loadAudio(context, url)));
        const gainNodes = audioBuffers.map(() => context.createGain());
        const sources = audioBuffers.map((buffer, index) => {
          const source = context.createBufferSource();
          source.buffer = buffer;
          source.loop = loop;
          source.connect(gainNodes[index]);
          return source;
        });

        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const compressor = context.createDynamicsCompressor();
        updateCompressorParams(compressor);

        gainNodes.forEach(gainNode => gainNode.connect(compressor));
        compressor.connect(analyser);
        analyser.connect(context.destination);

        setGainNodes(gainNodes);
        setSources(sources);
        analyserRef.current = analyser;
        dataArrayRef.current = dataArray;
        compressorRef.current = compressor;
        setDuration(Math.max(...audioBuffers.map(buffer => buffer.duration)));
        setMetadata(audioBuffers.map(buffer => ({
          duration: buffer.duration,
          numberOfChannels: buffer.numberOfChannels,
          sampleRate: buffer.sampleRate,
        })));
        setMutedTracks(new Array(audioBuffers.length).fill(false));

        return sources;
      };

      const initAudio = async () => {
        setIsLoading(true);
        const newSources = await setupAudio(audioContext, audioUrls);
        setIsLoading(false);
      };

      initAudio().catch(console.error);
    }
  }, [audioContext, audioUrls, loop]);

  const drawFrequencyData = () => {
    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / dataArray.length) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        barHeight = dataArray[i];

        canvasCtx.fillStyle = 'rgb(' + (barHeight + 100) + ',50,50)';
        canvasCtx.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2);

        x += barWidth + 1;
      }
    };

    draw();
  };

  const handlePlay = () => {
    if (!audioContext) {
      const context = new (window.AudioContext || window.webkitAudioContext)();
      setAudioContext(context);
    } else if (sources.length > 0) {
      sources.forEach(source => source.start(0));
      setIsPlaying(true);
      drawFrequencyData();
      intervalRef.current = setInterval(() => {
        setCurrentTime(audioContext.currentTime);
      }, 100);
    }
  };

  const handleStop = () => {
    if (sources.length > 0) {
      sources.forEach(source => source.stop(0));
      setIsPlaying(false);
      clearInterval(intervalRef.current);
      cancelAnimationFrame(animationFrameRef.current);
      setCurrentTime(0);
    }
  };

  const handleSliderChange = (event) => {
    const time = event.target.value;
    setCurrentTime(time);
    sources.forEach(source => {
      source.stop();
      source.start(0, time);
    });
  };

  const handleLoopToggle = () => {
    setLoop(!loop);
  };

  const toggleMute = (index) => {
    const newMutedTracks = [...mutedTracks];
    newMutedTracks[index] = !newMutedTracks[index];
    setMutedTracks(newMutedTracks);
    gainNodes[index].gain.value = newMutedTracks[index] ? 0 : 1;
  };

  const updateCompressorParams = (compressor) => {
    compressor.threshold.setValueAtTime(compressionParams.threshold, audioContext.currentTime);
    compressor.knee.setValueAtTime(compressionParams.knee, audioContext.currentTime);
    compressor.ratio.setValueAtTime(compressionParams.ratio, audioContext.currentTime);
    compressor.attack.setValueAtTime(compressionParams.attack, audioContext.currentTime);
    compressor.release.setValueAtTime(compressionParams.release, audioContext.currentTime);
  };

  const handleCompressorChange = (event) => {
    const { name, value } = event.target;
    setCompressionParams(prevParams => ({ ...prevParams, [name]: parseFloat(value) }));
    if (compressorRef.current) {
      updateCompressorParams(compressorRef.current);
    }
  };

  return (
      <div className="flex flex-col items-center p-6 bg-gray-100 rounded-lg shadow-lg">
        <canvas ref={canvasRef} width="600" height="100" className="mb-4"></canvas>
        <div className="mb-4">
          <button
              onClick={handlePlay}
              disabled={isPlaying || isLoading}
              className={`px-4 py-2 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  isLoading ? 'bg-yellow-500' : isPlaying ? 'bg-green-500' : 'bg-blue-500'
              }`}
          >
            {isLoading ? 'Loading...' : isPlaying ? 'Playing' : 'Play'}
          </button>
          <button
              onClick={handleStop}
              disabled={!isPlaying}
              className="px-4 py-2 ml-2 bg-red-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Stop
          </button>
        </div>
        <div className="mb-4">
          <label className="flex items-center">
            <input type="checkbox" checked={loop} onChange={handleLoopToggle} className="mr-2" />
            Loop
          </label>
        </div>
        <input
            type="range"
            min="0"
            max={duration}
            value={currentTime}
            onChange={handleSliderChange}
            disabled={!isPlaying}
            className="w-full mb-4"
        />
        <div className="w-full mb-4">
          <h3 className="text-lg font-semibold mb-2">Track Metadata:</h3>
          {metadata.map((meta, index) => (
              <div key={index} className="mb-2 p-2 bg-white rounded-lg shadow">
                <p className="font-semibold">Track {index + 1}:</p>
                <p>Duration: {meta.duration.toFixed(2)} seconds</p>
                <p>Channels: {meta.numberOfChannels}</p>
                <p>Sample Rate: {meta.sampleRate} Hz</p>
                <button
                    onClick={() => toggleMute(index)}
                    className={`px-4 py-2 mt-2 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                        mutedTracks[index] ? 'bg-gray-500' : 'bg-blue-500'
                    }`}
                >
                  {mutedTracks[index] ? 'Unmute' : 'Mute'}
                </button>
              </div>
          ))}
        </div>
        <div className="w-full mb-4">
          <h3 className="text-lg font-semibold mb-2">Compressor Settings:</h3>
          <div className="mb-2">
            <label className="block">
              Threshold: {compressionParams.threshold} dB
              <input
                  type="range"
                  name="threshold"
                  min="-100"
                  max="0"
                  step="1"
                  value={compressionParams.threshold}
                  onChange={handleCompressorChange}
                  className="w-full"
              />
            </label>
          </div>
          <div className="mb-2">
            <label className="block">
              Knee: {compressionParams.knee} dB
              <input
                  type="range"
                  name="knee"
                  min="0"
                  max="40"
                  step="1"
                  value={compressionParams.knee}
                  onChange={handleCompressorChange}
                  className="w-full"
              />
            </label>
          </div>
          <div className="mb-2">
            <label className="block">
              Ratio: {compressionParams.ratio}:1
              <input
                  type="range"
                  name="ratio"
                  min="1"
                  max="20"
                  step="1"
                  value={compressionParams.ratio}
                  onChange={handleCompressorChange}
                  className="w-full"
              />
            </label>
          </div>
          <div className="mb-2">
            <label className="block">
              Attack: {compressionParams.attack}s
              <input
                  type="range"
                  name="attack"
                  min="0"
                  max="1"
                  step="0.001"
                  value={compressionParams.attack}
                  onChange={handleCompressorChange}
                  className="w-full"
              />
            </label>
          </div>
          <div className="mb-2">
            <label className="block">
              Release: {compressionParams.release}s
              <input
                  type="range"
                  name="release"
                  min="0"
                  max="1"
                  step="0.001"
                  value={compressionParams.release}
                  onChange={handleCompressorChange}
                  className="w-full"
              />
            </label>
          </div>
        </div>
      </div>
  );
};

export default AudioSyncPlayer;
