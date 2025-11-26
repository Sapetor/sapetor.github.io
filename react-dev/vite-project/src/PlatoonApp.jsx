import { Play, Pause, RotateCcw, Settings, Info, Zap } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';

// Constants
const VEHICLE_COUNT = 6;
const LEADER_BASE_POSITION = 650;
const MAX_SPEED = 30; // m/s (108 km/h)
const MIN_SPEED = 0;
const PIXELS_PER_METER = 10;

// CACC Parameters
const MIN_SPACING = 5; // meters - minimum safety distance
const DEFAULT_TIME_HEADWAY = 1.2; // seconds
const VEHICLE_TIME_CONSTANT = 0.3; // seconds - actuator lag
const DT = 1/60; // 60 fps

// Initialize vehicles with CACC
const initializeVehicles = () => {
  return Array(VEHICLE_COUNT).fill(0).map((_, i) => ({
    id: i,
    position: 0, // meters
    velocity: 0, // m/s
    acceleration: 0, // m/s²
    desiredAcceleration: 0,
    color: `hsl(${(i * 360 / VEHICLE_COUNT + 200)}, 75%, 55%)`,
    isLeader: i === VEHICLE_COUNT - 1
  }));
};

// Road scenery elements
const generateScenery = () => {
  const elements = [];
  let id = 0;

  // Trees
  for (let x = 0; x < 3000; x += 80 + Math.random() * 40) {
    elements.push({
      id: id++,
      x,
      y: -50 - Math.random() * 20,
      type: 'tree',
      scale: 0.7 + Math.random() * 0.3,
      offset: Math.random() * 360
    });
  }

  // Buildings in background
  for (let x = 100; x < 3000; x += 200 + Math.random() * 100) {
    elements.push({
      id: id++,
      x,
      y: -120,
      type: 'building',
      scale: 0.8 + Math.random() * 0.4,
      height: 60 + Math.random() * 40
    });
  }

  // Road signs
  for (let x = 200; x < 3000; x += 400) {
    elements.push({
      id: id++,
      x,
      y: -30,
      type: 'sign',
      scale: 1
    });
  }

  return elements;
};

// Tree Component
const Tree = ({ x, y, scale, isDarkMode, offset }) => (
  <g transform={`translate(${x}, ${y}) scale(${scale})`}>
    <ellipse cx="0" cy="-25" rx="18" ry="25" fill={isDarkMode ? "#2d5016" : "#4a7c2e"} opacity="0.9" />
    <ellipse cx="-8" cy="-30" rx="15" ry="20" fill={isDarkMode ? "#3a6320" : "#5a9438"} opacity="0.8" />
    <ellipse cx="8" cy="-28" rx="13" ry="18" fill={isDarkMode ? "#3a6320" : "#5a9438"} opacity="0.8" />
    <rect x="-4" y="-10" width="8" height="20" fill="#3d2817" rx="2" />
  </g>
);

// Building Component
const Building = ({ x, y, scale, height, isDarkMode }) => {
  const windowRows = Math.floor(height / 15);
  const windows = [];

  for (let row = 0; row < windowRows; row++) {
    for (let col = 0; col < 3; col++) {
      windows.push(
        <rect
          key={`${row}-${col}`}
          x={-25 + col * 18}
          y={-height + 10 + row * 15}
          width="10"
          height="10"
          fill={isDarkMode ? "#4a5568" : "#cbd5e0"}
          opacity="0.8"
        />
      );
    }
  }

  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`}>
      <rect x="-30" y={-height} width="60" height={height} fill={isDarkMode ? "#2d3748" : "#4a5568"} opacity="0.6" />
      {windows}
      <polygon points="-30,0 0,-15 30,0" fill={isDarkMode ? "#1a202c" : "#2d3748"} opacity="0.7" />
    </g>
  );
};

// Road Sign Component
const RoadSign = ({ x, y, isDarkMode }) => (
  <g transform={`translate(${x}, ${y})`}>
    <rect x="-2" y="-5" width="4" height="35" fill={isDarkMode ? "#718096" : "#4a5568"} />
    <circle cx="0" cy="-15" r="12" fill="#3b82f6" stroke="#fff" strokeWidth="2" />
    <text x="0" y="-10" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold">V</text>
  </g>
);

// Enhanced Vehicle Component with detailed design
const VehicleComponent = ({ vehicle, isDarkMode, pixelX, showDetails }) => {
  const isAccelerating = vehicle.acceleration > 0.5;
  const isBraking = vehicle.acceleration < -0.5;

  return (
    <g transform={`translate(${pixelX}, 0)`}>
      {/* Vehicle shadow */}
      <ellipse cx="0" cy="25" rx="35" ry="8" fill="#000" opacity="0.2" />

      {/* Vehicle body with gradient */}
      <defs>
        <linearGradient id={`vehicle-grad-${vehicle.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{stopColor: vehicle.color, stopOpacity: 1}} />
          <stop offset="100%" style={{stopColor: vehicle.color, stopOpacity: 0.6}} />
        </linearGradient>
        <radialGradient id={`headlight-${vehicle.id}`}>
          <stop offset="0%" style={{stopColor: '#fff', stopOpacity: 0.8}} />
          <stop offset="100%" style={{stopColor: '#ffeb3b', stopOpacity: 0}} />
        </radialGradient>
      </defs>

      {/* Headlight beams when accelerating */}
      {isAccelerating && (
        <ellipse cx="45" cy="0" rx="60" ry="20" fill={`url(#headlight-${vehicle.id})`} opacity="0.4" />
      )}

      {/* Main body */}
      <rect x="-30" y="-12" width="60" height="24" fill={`url(#vehicle-grad-${vehicle.id})`} rx="8" />

      {/* Roof/cabin */}
      <path
        d="M -15,-12 L -10,-22 L 10,-22 L 15,-12 Z"
        fill={vehicle.color}
        opacity="0.8"
      />

      {/* Windows */}
      <rect x="-12" y="-20" width="10" height="8" fill={isDarkMode ? "#1a1a2e" : "#e0f2fe"} rx="2" opacity="0.9" />
      <rect x="2" y="-20" width="10" height="8" fill={isDarkMode ? "#1a1a2e" : "#e0f2fe"} rx="2" opacity="0.9" />

      {/* Wheels with rotation effect */}
      <circle cx="-18" cy="12" r="7" fill="#1a1a1a" />
      <circle cx="-18" cy="12" r="4" fill="#4a5568" />
      <circle cx="18" cy="12" r="7" fill="#1a1a1a" />
      <circle cx="18" cy="12" r="4" fill="#4a5568" />

      {/* Front grille */}
      <rect x="28" y="-8" width="2" height="16" fill="#1a1a1a" rx="1" />
      <rect x="28" y="-5" width="4" height="2" fill="#333" />
      <rect x="28" y="3" width="4" height="2" fill="#333" />

      {/* Headlights */}
      <circle cx="29" cy="-6" r="2.5" fill={isAccelerating ? "#ffeb3b" : "#fff9c4"} />
      <circle cx="29" cy="6" r="2.5" fill={isAccelerating ? "#ffeb3b" : "#fff9c4"} />

      {/* Brake lights */}
      <rect x="-30" y="-7" width="3" height="5" fill={isBraking ? "#ef4444" : "#7f1d1d"} rx="1" />
      <rect x="-30" y="2" width="3" height="5" fill={isBraking ? "#ef4444" : "#7f1d1d"} rx="1" />

      {/* Leader badge */}
      {vehicle.isLeader && (
        <g transform="translate(0, -35)">
          <rect x="-22" y="-12" width="44" height="18" fill="#fbbf24" rx="4" />
          <text x="0" y="2" textAnchor="middle" fill="#1f2937" fontSize="11" fontWeight="bold">
            LEADER
          </text>
        </g>
      )}

      {/* Velocity display */}
      {showDetails && (
        <g transform="translate(0, 35)">
          <rect x="-25" y="0" width="50" height="16" fill={isDarkMode ? "#1f2937" : "#fff"} rx="4" opacity="0.95" />
          <text x="0" y="11" textAnchor="middle" fill={isDarkMode ? "#fff" : "#1f2937"} fontSize="10" fontWeight="600">
            {vehicle.velocity.toFixed(1)} m/s
          </text>
        </g>
      )}

      {/* Spacing indicator */}
      {!vehicle.isLeader && showDetails && (
        <circle cx="0" cy="-28" r="5"
          fill={vehicle.spacingStatus === 'optimal' ? '#10b981' :
                vehicle.spacingStatus === 'close' ? '#ef4444' : '#3b82f6'}
          opacity="0.9"
        />
      )}
    </g>
  );
};

// Main Platoon App
const PlatoonApp = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [running, setRunning] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [scenery, setScenery] = useState([]);
  const [cameraOffset, setCameraOffset] = useState(0);

  // CACC parameters
  const [timeHeadway, setTimeHeadway] = useState(DEFAULT_TIME_HEADWAY);
  const [targetSpeed, setTargetSpeed] = useState(20); // m/s
  const [kp, setKp] = useState(0.4);
  const [kd, setKd] = useState(0.8);

  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [emergencyBrake, setEmergencyBrake] = useState(false);

  const animationRef = useRef(null);
  const lastTimeRef = useRef(0);

  // Detect dark mode
  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeMediaQuery.matches);
    const handler = (e) => setIsDarkMode(e.matches);
    darkModeMediaQuery.addEventListener('change', handler);
    return () => darkModeMediaQuery.removeEventListener('change', handler);
  }, []);

  // CACC Control Law
  const calculateCACCAcceleration = (vehicle, leaderVehicle) => {
    const actualSpacing = leaderVehicle.position - vehicle.position;
    const desiredSpacing = MIN_SPACING + timeHeadway * vehicle.velocity;
    const spacingError = actualSpacing - desiredSpacing;
    const velocityError = vehicle.velocity - leaderVehicle.velocity;

    // Store spacing info for visualization
    vehicle.actualSpacing = actualSpacing;
    vehicle.desiredSpacing = desiredSpacing;
    vehicle.spacingStatus = Math.abs(spacingError) < 2 ? 'optimal' :
                            spacingError < 0 ? 'close' : 'far';

    // CACC control law: u = kp * spacing_error - kd * velocity_error
    const controlInput = kp * spacingError - kd * velocityError;

    // Clamp to realistic acceleration limits
    return Math.max(-8, Math.min(3, controlInput));
  };

  // Animation loop
  const updateSimulation = (timestamp) => {
    if (!running) return;

    const deltaTime = lastTimeRef.current ? Math.min((timestamp - lastTimeRef.current) / 1000, 0.1) : DT;
    lastTimeRef.current = timestamp;

    setVehicles(prev => {
      const newVehicles = [...prev];
      const leaderIndex = VEHICLE_COUNT - 1;
      const leader = newVehicles[leaderIndex];

      // Leader follows target speed with smooth acceleration
      const leaderTargetSpeed = emergencyBrake ? 0 : targetSpeed;
      const speedError = leaderTargetSpeed - leader.velocity;
      leader.desiredAcceleration = Math.sign(speedError) * Math.min(Math.abs(speedError) * 2, 3);

      // First-order actuator dynamics for leader
      const accelError = leader.desiredAcceleration - leader.acceleration;
      leader.acceleration += (accelError / VEHICLE_TIME_CONSTANT) * deltaTime;

      // Update leader velocity and position
      leader.velocity = Math.max(0, Math.min(MAX_SPEED, leader.velocity + leader.acceleration * deltaTime));
      leader.position += leader.velocity * deltaTime;

      // Update followers with CACC
      for (let i = leaderIndex - 1; i >= 0; i--) {
        const vehicle = newVehicles[i];
        const leaderVehicle = newVehicles[i + 1];

        // Calculate CACC control input
        vehicle.desiredAcceleration = calculateCACCAcceleration(vehicle, leaderVehicle);

        // First-order actuator dynamics
        const accelError = vehicle.desiredAcceleration - vehicle.acceleration;
        vehicle.acceleration += (accelError / VEHICLE_TIME_CONSTANT) * deltaTime;

        // Update velocity and position
        vehicle.velocity = Math.max(0, Math.min(MAX_SPEED, vehicle.velocity + vehicle.acceleration * deltaTime));
        vehicle.position += vehicle.velocity * deltaTime;
      }

      return newVehicles;
    });

    // Update camera to follow leader
    if (vehicles.length > 0) {
      const leader = vehicles[VEHICLE_COUNT - 1];
      setCameraOffset(leader.position);
    }

    animationRef.current = requestAnimationFrame(updateSimulation);
  };

  // Start simulation
  const handleStart = () => {
    const newVehicles = initializeVehicles();
    const initialSpacing = MIN_SPACING + timeHeadway * 0;

    // Position vehicles
    for (let i = VEHICLE_COUNT - 1; i >= 0; i--) {
      if (i === VEHICLE_COUNT - 1) {
        newVehicles[i].position = 0;
      } else {
        newVehicles[i].position = newVehicles[i + 1].position - initialSpacing;
      }
    }

    setVehicles(newVehicles);
    setScenery(generateScenery());
    setCameraOffset(0);
    lastTimeRef.current = 0;
    setRunning(true);
  };

  // Stop simulation
  const handleStop = () => {
    setRunning(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  // Reset simulation
  const handleReset = () => {
    handleStop();
    setVehicles([]);
    setScenery([]);
    setCameraOffset(0);
    setEmergencyBrake(false);
  };

  // Animation effect
  useEffect(() => {
    if (running) {
      animationRef.current = requestAnimationFrame(updateSimulation);
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [running, kp, kd, timeHeadway, targetSpeed, emergencyBrake]);

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gradient-to-br from-blue-50 via-white to-purple-50 text-gray-900'}`}>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Vehicle Platoon Animation
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Cooperative Adaptive Cruise Control with Constant Time Headway
          </p>
        </div>

        {/* Control Panel */}
        <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-2xl p-6 mb-6`}>
          <div className="flex flex-wrap gap-4 justify-center items-center mb-6">
            <button
              onClick={running ? handleStop : handleStart}
              className={`flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-lg shadow-lg transition-all transform hover:scale-105 ${
                running
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600'
                  : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
              } text-white`}
            >
              {running ? <><Pause size={24} /> Pause</> : <><Play size={24} /> Start</>}
            </button>

            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-8 py-4 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-bold text-lg shadow-lg transition-all transform hover:scale-105"
            >
              <RotateCcw size={24} /> Reset
            </button>

            {running && (
              <button
                onMouseDown={() => setEmergencyBrake(true)}
                onMouseUp={() => setEmergencyBrake(false)}
                onTouchStart={() => setEmergencyBrake(true)}
                onTouchEnd={() => setEmergencyBrake(false)}
                className={`flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-lg shadow-lg transition-all transform ${
                  emergencyBrake
                    ? 'bg-red-700 scale-105'
                    : 'bg-red-500 hover:bg-red-600 hover:scale-105'
                } text-white`}
              >
                <Zap size={24} /> Emergency Brake
              </button>
            )}

            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center gap-2 px-6 py-4 rounded-xl font-semibold shadow-lg transition-all ${
                isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              <Settings size={20} /> Settings
            </button>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-xl p-6 mb-4`}>
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Settings size={20} /> CACC Parameters
              </h3>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Target Speed: {targetSpeed.toFixed(1)} m/s ({(targetSpeed * 3.6).toFixed(0)} km/h)
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    step="0.5"
                    value={targetSpeed}
                    onChange={(e) => setTargetSpeed(parseFloat(e.target.value))}
                    className="w-full h-3 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Time Headway (τ): {timeHeadway.toFixed(2)} seconds
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.1"
                    value={timeHeadway}
                    onChange={(e) => setTimeHeadway(parseFloat(e.target.value))}
                    className="w-full h-3 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Position Gain (Kp): {kp.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={kp}
                    onChange={(e) => setKp(parseFloat(e.target.value))}
                    className="w-full h-3 bg-green-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Velocity Gain (Kd): {kd.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="2.0"
                    step="0.05"
                    value={kd}
                    onChange={(e) => setKd(parseFloat(e.target.value))}
                    className="w-full h-3 bg-orange-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                  />
                </div>
              </div>

              <div className={`mt-4 p-4 ${isDarkMode ? 'bg-gray-600' : 'bg-blue-50'} rounded-lg`}>
                <p className="text-sm">
                  <strong>CACC Formula:</strong> d<sub>desired</sub> = d<sub>min</sub> + τ · v<sub>ego</sub>
                </p>
                <p className="text-sm mt-1">
                  <strong>Control Law:</strong> a = K<sub>p</sub>·(d<sub>actual</sub> - d<sub>desired</sub>) - K<sub>d</sub>·(v<sub>ego</sub> - v<sub>leader</sub>)
                </p>
              </div>
            </div>
          )}

          {/* Info Display */}
          {running && vehicles.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className={`${isDarkMode ? 'bg-gradient-to-br from-blue-900 to-blue-800' : 'bg-gradient-to-br from-blue-100 to-blue-50'} p-4 rounded-xl`}>
                <div className="text-xs font-semibold opacity-75 mb-1">Leader Speed</div>
                <div className="text-2xl font-bold">
                  {vehicles[VEHICLE_COUNT - 1].velocity.toFixed(1)} m/s
                </div>
                <div className="text-xs opacity-75">
                  {(vehicles[VEHICLE_COUNT - 1].velocity * 3.6).toFixed(0)} km/h
                </div>
              </div>

              <div className={`${isDarkMode ? 'bg-gradient-to-br from-green-900 to-green-800' : 'bg-gradient-to-br from-green-100 to-green-50'} p-4 rounded-xl`}>
                <div className="text-xs font-semibold opacity-75 mb-1">Avg Spacing</div>
                <div className="text-2xl font-bold">
                  {vehicles.length > 1
                    ? ((vehicles[VEHICLE_COUNT-1].position - vehicles[0].position) / (VEHICLE_COUNT-1)).toFixed(1)
                    : '0.0'} m
                </div>
              </div>

              <div className={`${isDarkMode ? 'bg-gradient-to-br from-purple-900 to-purple-800' : 'bg-gradient-to-br from-purple-100 to-purple-50'} p-4 rounded-xl`}>
                <div className="text-xs font-semibold opacity-75 mb-1">Time Headway</div>
                <div className="text-2xl font-bold">{timeHeadway.toFixed(1)}s</div>
              </div>

              <div className={`${isDarkMode ? 'bg-gradient-to-br from-orange-900 to-orange-800' : 'bg-gradient-to-br from-orange-100 to-orange-50'} p-4 rounded-xl`}>
                <div className="text-xs font-semibold opacity-75 mb-1">Platoon Length</div>
                <div className="text-2xl font-bold">
                  {vehicles.length > 1
                    ? (vehicles[VEHICLE_COUNT-1].position - vehicles[0].position).toFixed(0)
                    : '0'} m
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Animation Canvas */}
        <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-2 rounded-2xl overflow-hidden shadow-2xl mb-6`}>
          <svg width="100%" height="400" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid meet">
            {/* Sky gradient */}
            <defs>
              <linearGradient id="sky-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{stopColor: isDarkMode ? '#1e3a8a' : '#60a5fa', stopOpacity: 1}} />
                <stop offset="100%" style={{stopColor: isDarkMode ? '#1e40af' : '#93c5fd', stopOpacity: 1}} />
              </linearGradient>
              <linearGradient id="road-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{stopColor: '#4b5563', stopOpacity: 1}} />
                <stop offset="100%" style={{stopColor: '#1f2937', stopOpacity: 1}} />
              </linearGradient>
            </defs>

            {/* Sky */}
            <rect width="1200" height="250" fill="url(#sky-gradient)" />

            {/* Sun/Moon */}
            <circle cx="1000" cy="80" r="40" fill={isDarkMode ? '#fbbf24' : '#fef08a'} opacity={isDarkMode ? 0.6 : 0.9} />

            {/* Ground */}
            <rect y="250" width="1200" height="30" fill={isDarkMode ? '#1a4d2e' : '#86efac'} />

            {/* Road */}
            <rect y="280" width="1200" height="120" fill="url(#road-gradient)" />

            {/* Road markings */}
            {Array.from({length: 20}, (_, i) => (
              <rect
                key={i}
                x={(i * 80 - (cameraOffset * PIXELS_PER_METER) % 80)}
                y="335"
                width="40"
                height="6"
                fill="#fbbf24"
                rx="2"
              />
            ))}

            {/* Road edges */}
            <rect y="280" width="1200" height="4" fill="#fff" opacity="0.8" />
            <rect y="396" width="1200" height="4" fill="#fff" opacity="0.8" />

            {/* Scenery elements */}
            {scenery.map(element => {
              const screenX = (element.x - cameraOffset) * PIXELS_PER_METER + 600;
              if (screenX < -100 || screenX > 1300) return null;

              if (element.type === 'tree') {
                return <Tree key={element.id} x={screenX} y={250 + element.y} scale={element.scale} isDarkMode={isDarkMode} offset={element.offset} />;
              } else if (element.type === 'building') {
                return <Building key={element.id} x={screenX} y={250 + element.y} scale={element.scale} height={element.height} isDarkMode={isDarkMode} />;
              } else if (element.type === 'sign') {
                return <RoadSign key={element.id} x={screenX} y={250 + element.y} isDarkMode={isDarkMode} />;
              }
              return null;
            })}

            {/* Vehicles */}
            {vehicles.map(vehicle => {
              const screenX = (vehicle.position - cameraOffset) * PIXELS_PER_METER + 600;
              return (
                <g key={vehicle.id} transform={`translate(0, 340)`}>
                  <VehicleComponent
                    vehicle={vehicle}
                    isDarkMode={isDarkMode}
                    pixelX={screenX}
                    showDetails={showDetails}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6`}>
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Info size={20} /> About CACC
          </h3>

          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-semibold mb-2">Cooperative Adaptive Cruise Control</h4>
              <p className="mb-2">
                CACC enables vehicles to maintain safe following distances while maximizing traffic flow.
                Each vehicle adjusts its speed based on the leader's velocity and the spacing error.
              </p>
              <p>
                The constant time headway policy ensures spacing increases with speed, maintaining safety
                at higher velocities.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Visual Indicators</h4>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-green-500"></span>
                  <span>Optimal spacing maintained</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-blue-500"></span>
                  <span>Too far from leader</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-red-500"></span>
                  <span>Too close - safety risk</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlatoonApp;
