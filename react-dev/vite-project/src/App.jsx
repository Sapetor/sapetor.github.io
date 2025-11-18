import { Play, Pause, RotateCcw, Info } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';

// Helper Constants
const VEHICLE_COUNT = 5;
const LEADER_BASE_POSITION = 600;
const MAX_SPEED = 5;
const HISTORY_LENGTH = 100;

// Vehicle Dynamics and Control Constants
const MIN_SPACING = 50; // Minimum spacing d_0 (meters converted to pixels)
const TIME_HEADWAY = 1.0; // Constant time headway τ (seconds)
const SPEED_TO_PIXEL_RATIO = 50; // Conversion: 1 m/s = 50 pixels in simulation
const DT = 0.016; // Time step (seconds) - approximately 60fps

// Preset scenarios for control gains
const PRESETS = {
  stable: {
    name: "String Stable",
    description: "Optimal control gains for string stability",
    kp: 0.5,
    kd: 0.8
  },
  aggressive: {
    name: "Aggressive (Unstable)",
    description: "High position gain, low damping - causes oscillations",
    kp: 1.2,
    kd: 0.2
  },
  conservative: {
    name: "Conservative",
    description: "Low gains, slow response",
    kp: 0.2,
    kd: 0.6
  },
  underdamped: {
    name: "Underdamped",
    description: "Low damping leads to oscillations",
    kp: 0.6,
    kd: 0.3
  }
};

// Element type definitions for scenery
const elementTypes = [
  { type: 'tree', scale: 1.0, yOffset: 0, speed: 'foreground', layer: 1 },
  { type: 'smallTree', scale: 0.6, yOffset: 10, speed: 'background', layer: 0 },
  { type: 'streetlight', speed: 'foreground', layer: 3 },
  { type: 'building', scale: 1.2, yOffset: 0, speed: 'background', layer: 2 }
];

// Generate background elements
const generateElements = () => {
  const newElements = [];
  let id = 1;

  // Buildings
  let lastBuildingX = 800;
  while (lastBuildingX < 2400) {
    newElements.push({
      id: id++,
      x: lastBuildingX + Math.random() * 100,
      type: 3,
      scale: 1.2
    });
    lastBuildingX += 600 + Math.random() * 200;
  }

  // Background trees
  for (let x = 800; x < 2400; x += 250 + Math.random() * 150) {
    newElements.push({
      id: id++,
      x: x + Math.random() * 100,
      type: 1,
      scale: 0.6 + Math.random() * 0.2
    });
  }

  // Front trees
  for (let x = 800; x < 2400; x += 200 + Math.random() * 200) {
    newElements.push({
      id: id++,
      x: x + Math.random() * 100,
      type: 0,
      scale: 1.0 + Math.random() * 0.2
    });
  }

  // Street lights
  const LIGHT_SPACING = 300;
  for (let x = 800; x < 2400; x += LIGHT_SPACING) {
    newElements.push({
      id: id++,
      x: x + 50,
      type: 2
    });
  }

  return newElements.sort((a, b) => {
    const layerDiff = elementTypes[a.type].layer - elementTypes[b.type].layer;
    return layerDiff !== 0 ? layerDiff : a.x - b.x;
  });
};

const initializeVehicles = () => {
  return Array(VEHICLE_COUNT).fill(0).map((_, i) => ({
    id: i,
    x: 0,
    velocity: 0,
    acceleration: 0,
    color: `hsl(${(i * 360 / VEHICLE_COUNT)}, 70%, 50%)`,
    braking: false
  }));
};

// Background Element Component
const BackgroundElement = ({ x, isDarkMode, scale = 1, yOffset = 0, type }) => {
  if (type === 'tree') return (
    <g transform={`translate(${x}, ${yOffset}) scale(${scale})`}>
      <rect x="-20" y="110" width="40" height="3.5" fill={isDarkMode ? "#2d4" : "#3a5"} rx="2" />
      <rect x="-4" y="80" width="8" height="30" fill={"#381d11"} />
      <path d="M -15 80 L 0 40 L 15 80 Z" fill={isDarkMode ? "#2d4" : "#3a5"} />
      <path d="M -12 60 L 0 25 L 12 60 Z" fill={isDarkMode ? "#2d4" : "#3a5"} />
    </g>
  );

  if (type === 'building') return (
    <g transform={`translate(${x}, ${yOffset}) scale(${scale})`}>
      <rect x="-20" y="20" width="40" height="105" fill={isDarkMode ? "#444" : "#666"} />
      <rect x="-15" y="25" width="10" height="15" fill={isDarkMode ? "#666" : "#999"} />
      <rect x="5" y="25" width="10" height="15" fill={isDarkMode ? "#666" : "#999"} />
    </g>
  );

  if (type === 'smallTree') return (
    <g transform={`translate(${x}, ${yOffset}) scale(${scale})`}>
      <rect x="-20" y="120" width="40" height="5" fill={isDarkMode ? "#685" : "#685"} rx="2" />
      <rect x="-4" y="90" width="8" height="30" fill={"#331d15"} />
      <path d="M -15 90 L 0 50 L 15 90 Z" fill={isDarkMode ? "#685" : "#685"} />
      <path d="M -12 70 L 0 35 L 12 70 Z" fill={isDarkMode ? "#685" : "#685"} />
    </g>
  );

  return null;
};

// Street Light Component
const StreetLight = ({ x, isDarkMode }) => {
  const poleColor = isDarkMode ? "#666" : "#444";
  const lightColor = isDarkMode ? "#ffeb3b" : "#ffd700";

  return (
    <g transform={`translate(${x}, 0)`}>
      <rect x="-3" y="110" width="6" height="40" fill={poleColor} />
      <circle cx="0" cy="110" r="8" fill={lightColor} />
      <path d="M -8 110 Q 0 90 8 110" fill={lightColor} opacity="0.3" />
    </g>
  );
};

// Vehicle Component
const Vehicle = ({ x, color, isLeader, isDarkMode, velocity, acceleration, desiredSpacing, actualSpacing }) => {
  const isAccelerating = acceleration > 0.01;
  const isDecelerating = acceleration < -0.01;

  const spacingError = actualSpacing !== undefined ? (actualSpacing - desiredSpacing) : 0;
  const spacingStatus = Math.abs(spacingError) < 10 ? "optimal" :
                        spacingError > 0 ? "too-far" : "too-close";

  return (
    <g transform={`translate(${x}, 150)`}>
      {/* Vehicle body with gradient */}
      <defs>
        <linearGradient id={`grad-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{stopColor: color, stopOpacity: 1}} />
          <stop offset="100%" style={{stopColor: color, stopOpacity: 0.7}} />
        </linearGradient>
      </defs>
      <rect x="-20" y="-10" width="40" height="20" fill={`url(#grad-${color})`} rx="5" />

      {/* Windows */}
      <rect x="-15" y="-8" width="12" height="6" fill={isDarkMode ? "#222" : "#ddd"} rx="1" />

      {/* Wheels */}
      <circle cx="-12" cy="12" r="5" fill={isDarkMode ? "#ddd" : "#333"} />
      <circle cx="12" cy="12" r="5" fill={isDarkMode ? "#ddd" : "#333"} />

      {/* Brake lights */}
      {isDecelerating && (
        <rect x="-18" y="-8" width="6" height="3" fill="#f00" />
      )}

      {/* Headlights */}
      {isAccelerating && (
        <rect x="12" y="-8" width="6" height="3" fill="#ff0" />
      )}

      {/* Leader label */}
      {isLeader && (
        <>
          <rect x="-20" y="-35" width="40" height="20" fill={color} rx="3" opacity="0.9" />
          <text x="0" y="-21" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">
            LEADER
          </text>
        </>
      )}

      {/* Speed indicator */}
      <text x="0" y="2" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="500">
        {Math.abs(velocity * (1/SPEED_TO_PIXEL_RATIO)).toFixed(1)} m/s
      </text>

      {/* Spacing status indicator */}
      {!isLeader && actualSpacing !== undefined && (
        <circle
          cx="0"
          cy="-18"
          r="4"
          fill={spacingStatus === "optimal" ? "#10b981" :
                spacingStatus === "too-far" ? "#3b82f6" : "#ef4444"}
          opacity="0.8"
        />
      )}
    </g>
  );
};

// Mini chart for velocity history
const VelocityChart = ({ history, isDarkMode }) => {
  if (history.length < 2) return null;

  const width = 400;
  const height = 100;
  const maxVel = Math.max(...history.flat(), 0.1);

  return (
    <svg width={width} height={height} className="border border-gray-300 dark:border-gray-600 rounded">
      <rect width={width} height={height} fill={isDarkMode ? "#1f2937" : "#f9fafb"} />

      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((frac, i) => (
        <line
          key={i}
          x1="0"
          y1={height * frac}
          x2={width}
          y2={height * frac}
          stroke={isDarkMode ? "#374151" : "#e5e7eb"}
          strokeWidth="1"
        />
      ))}

      {/* Velocity curves */}
      {history[0]?.map((_, vehicleIdx) => {
        const points = history.map((snapshot, timeIdx) => {
          const x = (timeIdx / (HISTORY_LENGTH - 1)) * width;
          const y = height - (snapshot[vehicleIdx] / maxVel) * (height - 20);
          return `${x},${y}`;
        }).join(' ');

        return (
          <polyline
            key={vehicleIdx}
            points={points}
            fill="none"
            stroke={`hsl(${(vehicleIdx * 360 / VEHICLE_COUNT)}, 70%, 50%)`}
            strokeWidth="2"
            opacity="0.8"
          />
        );
      })}

      <text x="5" y="15" fill={isDarkMode ? "#9ca3af" : "#6b7280"} fontSize="11" fontWeight="500">
        Velocity History (m/s)
      </text>
      <text x="5" y={height - 5} fill={isDarkMode ? "#9ca3af" : "#6b7280"} fontSize="9">
        0
      </text>
      <text x={width - 35} y={height - 5} fill={isDarkMode ? "#9ca3af" : "#6b7280"} fontSize="9">
        {(HISTORY_LENGTH * DT).toFixed(0)}s
      </text>
    </svg>
  );
};

// Main Component
const EnhancedStringStabilityDemo = () => {
  // State
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [running, setRunning] = useState(false);
  const [elements, setElements] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [targetSpeed, setTargetSpeed] = useState(2.0);
  const [kp, setKp] = useState(0.5); // Position gain
  const [kd, setKd] = useState(0.8); // Velocity/damping gain
  const [leadVehicleSpeed, setLeadVehicleSpeed] = useState(0);
  const [applyingBrake, setApplyingBrake] = useState(false);
  const [stabilityScore, setStabilityScore] = useState(100);
  const [showInfo, setShowInfo] = useState(false);
  const [velocityHistory, setVelocityHistory] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState('stable');

  // Animation refs
  const animationRef = useRef(null);
  const lastTimeRef = useRef(0);

  // Apply preset
  const applyPreset = (presetKey) => {
    const preset = PRESETS[presetKey];
    setKp(preset.kp);
    setKd(preset.kd);
    setSelectedPreset(presetKey);
  };

  // Calculate desired spacing based on constant time headway policy
  const calculateDesiredSpacing = (leaderVelocity) => {
    return MIN_SPACING + TIME_HEADWAY * leaderVelocity;
  };

  // Calculate stability score
  const calculateStabilityScore = (vehicles) => {
    if (vehicles.length < 2) return 100;

    const leaderVelocity = vehicles[vehicles.length - 1].velocity;

    // Velocity uniformity - how close are follower velocities to leader
    const velocityDiffs = vehicles.map(v => Math.abs(v.velocity - leaderVelocity));
    const maxVelDiff = Math.max(...velocityDiffs);
    const velocityScore = 100 * Math.exp(-maxVelDiff / 0.5);

    // Spacing error - how close is actual spacing to desired
    const desiredSpacing = calculateDesiredSpacing(leaderVelocity);
    const spacingErrors = vehicles.slice(0, -1).map((v, i) => {
      const leadVehicle = vehicles[i + 1];
      const actualSpacing = leadVehicle.x - v.x;
      const relativeError = Math.abs(actualSpacing - desiredSpacing) / Math.max(desiredSpacing, 1);
      return relativeError;
    });

    const maxSpacingError = Math.max(...spacingErrors, 0);
    const spacingScore = 100 * Math.exp(-maxSpacingError * 2);

    return velocityScore * 0.6 + spacingScore * 0.4;
  };

  // Animation update function with correct dynamics
  const updateScene = (timestamp) => {
    if (!running) return;

    const deltaTime = lastTimeRef.current ? Math.min((timestamp - lastTimeRef.current) / 1000, 0.1) : DT;
    lastTimeRef.current = timestamp;

    setVehicles(prev => {
      const newVehicles = [...prev];
      const leaderIndex = newVehicles.length - 1;
      const leader = newVehicles[leaderIndex];

      // Leader dynamics - simple acceleration towards target speed
      const leaderTargetSpeed = applyingBrake ? 0 : targetSpeed;
      const speedError = leaderTargetSpeed - leader.velocity;

      // Leader acceleration with smooth response
      leader.acceleration = Math.sign(speedError) * Math.min(Math.abs(speedError) * 0.3, 0.05);
      leader.velocity += leader.acceleration;
      leader.velocity = Math.max(0, Math.min(leader.velocity, MAX_SPEED));

      // Leader stays at fixed position (for visualization)
      leader.x = LEADER_BASE_POSITION;
      leader.braking = leader.acceleration < -0.01;

      setLeadVehicleSpeed(leader.velocity);

      // Follower dynamics with constant time headway control law
      for (let i = leaderIndex - 1; i >= 0; i--) {
        const vehicle = newVehicles[i];
        const leadVehicle = newVehicles[i + 1];

        // Current state
        const actualSpacing = leadVehicle.x - vehicle.x;
        const desiredSpacing = calculateDesiredSpacing(leadVehicle.velocity);
        const spacingError = actualSpacing - desiredSpacing;
        const velocityError = vehicle.velocity - leadVehicle.velocity;

        // Store for display
        vehicle.actualSpacing = actualSpacing;
        vehicle.desiredSpacing = desiredSpacing;

        // Control law: u_i = K_p * spacing_error - K_d * velocity_error
        // Note: spacing_error is positive when too far, so we accelerate (positive control)
        //       velocity_error is positive when going faster than leader, so we decelerate (negative control)
        const controlInput = kp * spacingError - kd * velocityError;

        // Apply control input as acceleration (with saturation)
        vehicle.acceleration = Math.max(-0.2, Math.min(0.05, controlInput));

        // Integrate dynamics: v(t+dt) = v(t) + a*dt
        vehicle.velocity += vehicle.acceleration * deltaTime;
        vehicle.velocity = Math.max(0, Math.min(vehicle.velocity, MAX_SPEED));

        // Integrate position: x(t+dt) = x(t) + v*dt
        vehicle.x += vehicle.velocity * deltaTime;

        // Visual indicator
        vehicle.braking = vehicle.acceleration < -0.01;
      }

      // Calculate stability score
      const newScore = calculateStabilityScore(newVehicles);
      setStabilityScore(newScore);

      // Update velocity history (convert to m/s for display)
      setVelocityHistory(prev => {
        const newHistory = [...prev, newVehicles.map(v => v.velocity * (1/SPEED_TO_PIXEL_RATIO))];
        return newHistory.slice(-HISTORY_LENGTH);
      });

      return newVehicles;
    });

    // Update background elements
    const leaderSpeed = vehicles.length > 0 ? vehicles[vehicles.length - 1].velocity : 0;
    const foregroundMovement = leaderSpeed * deltaTime;
    const backgroundMovement = leaderSpeed * deltaTime * 0.6;

    setElements(prev => {
      return prev.map(el => {
        const config = elementTypes[el.type];
        const movement = config.speed === 'foreground' ? foregroundMovement : backgroundMovement;
        let newX = el.x - movement;

        if (el.type === 2 && newX < -200) {
          const overflow = -newX - 200;
          const intervals = Math.ceil(overflow / 300);
          newX = 800 + (intervals * 300) + 50;
        } else if (newX < -200) {
          newX = 800 + Math.random() * 400;
        }

        return { ...el, x: newX };
      });
    });

    animationRef.current = requestAnimationFrame(updateScene);
  };

  // Start animation
  const handleStartAnimation = () => {
    const newVehicles = initializeVehicles();
    const leaderIndex = VEHICLE_COUNT - 1;

    // Initialize leader
    newVehicles[leaderIndex].x = LEADER_BASE_POSITION;
    newVehicles[leaderIndex].velocity = 0;

    // Initialize followers with proper spacing
    const initialSpacing = MIN_SPACING + TIME_HEADWAY * 0; // Start with spacing for v=0
    for (let i = leaderIndex - 1; i >= 0; i--) {
      newVehicles[i].x = newVehicles[i + 1].x - initialSpacing;
      newVehicles[i].velocity = 0;
    }

    setElements(generateElements());
    setVehicles(newVehicles);
    setLeadVehicleSpeed(0);
    setVelocityHistory([]);
    lastTimeRef.current = 0;
    setRunning(true);
  };

  // Stop animation
  const handleStopAnimation = () => {
    setRunning(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  };

  // Reset simulation
  const handleReset = () => {
    handleStopAnimation();
    setVehicles([]);
    setElements([]);
    setVelocityHistory([]);
    setTargetSpeed(2.0);
    setApplyingBrake(false);
  };

  // Animation effect
  useEffect(() => {
    if (running) {
      animationRef.current = requestAnimationFrame(updateScene);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [running, kp, kd]);

  // Dark mode effect
  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeMediaQuery.matches);

    const handleChange = (e) => setIsDarkMode(e.matches);
    darkModeMediaQuery.addEventListener('change', handleChange);
    return () => darkModeMediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Metrics Display Component
  const MetricsDisplay = () => {
    const avgSpacing = vehicles.length > 1 ?
      ((vehicles[vehicles.length-1].x - vehicles[0].x) / (vehicles.length-1)).toFixed(0) :
      MIN_SPACING;

    const desiredSpacing = calculateDesiredSpacing(leadVehicleSpeed);

    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900 dark:to-blue-800 p-4 rounded-xl shadow-sm">
          <div className="text-xs text-blue-700 dark:text-blue-200 font-medium mb-1">Target Speed</div>
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
            {(targetSpeed * (1/SPEED_TO_PIXEL_RATIO)).toFixed(1)} m/s
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900 dark:to-green-800 p-4 rounded-xl shadow-sm">
          <div className="text-xs text-green-700 dark:text-green-200 font-medium mb-1">Leader Speed</div>
          <div className="text-2xl font-bold text-green-900 dark:text-green-100">
            {(leadVehicleSpeed * (1/SPEED_TO_PIXEL_RATIO)).toFixed(1)} m/s
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900 dark:to-purple-800 p-4 rounded-xl shadow-sm">
          <div className="text-xs text-purple-700 dark:text-purple-200 font-medium mb-1">Avg Spacing</div>
          <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
            {avgSpacing}px
            <div className="text-xs font-normal">d* = {desiredSpacing.toFixed(0)}px</div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900 dark:to-amber-800 p-4 rounded-xl shadow-sm">
          <div className="text-xs text-amber-700 dark:text-amber-200 font-medium mb-1">Stability Score</div>
          <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">{stabilityScore.toFixed(0)}%</div>
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen p-4 lg:p-8 ${isDarkMode ? 'dark bg-gray-900 text-gray-100' : 'bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900'} transition-colors duration-300`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl lg:text-5xl font-bold mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            String Stability in Vehicle Platooning
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Constant time headway policy with predecessor-following control
          </p>
          <div className="mt-4 flex justify-center gap-4 text-sm">
            <a href="https://scholar.google.com/citations?user=MrFi22oAAAAJ" target="_blank" rel="noopener noreferrer"
               className="text-blue-600 dark:text-blue-400 hover:underline">
              Research Publications
            </a>
            <span className="text-gray-400">•</span>
            <button onClick={() => setShowInfo(!showInfo)} className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
              <Info size={14} /> About This Demo
            </button>
          </div>
        </div>

        {/* Info Panel */}
        {showInfo && (
          <div className="mb-6 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl">
            <h3 className="font-bold text-lg mb-3">Control Law & String Stability</h3>
            <div className="space-y-3 text-sm">
              <p>
                <strong>Constant Time Headway Policy:</strong> The desired spacing between vehicles is
                <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded mx-1">
                  d* = d₀ + τ·v<sub>lead</sub>
                </code>
                where d₀ = {MIN_SPACING}px and τ = {TIME_HEADWAY}s (constant).
              </p>
              <p>
                <strong>Control Law:</strong> Each vehicle uses a PD controller:
                <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded mx-1 block mt-1">
                  u<sub>i</sub> = K<sub>p</sub>·(x<sub>i+1</sub> - x<sub>i</sub> - d*) - K<sub>d</sub>·(v<sub>i</sub> - v<sub>i+1</sub>)
                </code>
              </p>
              <p>
                <strong>String Stability:</strong> For the platoon to be string stable, disturbances should not amplify
                as they propagate. The gains K<sub>p</sub> and K<sub>d</sub> must satisfy specific conditions related to
                the time headway τ.
              </p>
              <p className="text-xs mt-3 text-gray-600 dark:text-gray-400">
                Try the "Aggressive (Unstable)" preset to see string instability - oscillations amplify along the platoon!
              </p>
            </div>
          </div>
        )}

        {/* Metrics */}
        {running && <MetricsDisplay />}

        {/* Main Controls */}
        <div className="mb-6 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
          <div className="flex flex-wrap gap-3 justify-center items-center mb-6">
            <button
              onClick={running ? handleStopAnimation : handleStartAnimation}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 font-medium shadow-md transition-all flex items-center gap-2"
            >
              {running ? <><Pause size={18} /> Pause</> : <><Play size={18} /> Start</>}
            </button>

            <button
              onClick={handleReset}
              className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium shadow-md transition-all flex items-center gap-2"
            >
              <RotateCcw size={18} /> Reset
            </button>

            {running && (
              <button
                onMouseDown={() => setApplyingBrake(true)}
                onMouseUp={() => setApplyingBrake(false)}
                onMouseLeave={() => setApplyingBrake(false)}
                onTouchStart={() => setApplyingBrake(true)}
                onTouchEnd={() => setApplyingBrake(false)}
                className={`px-6 py-3 ${applyingBrake ? 'bg-red-600' : 'bg-red-500'} text-white rounded-lg hover:bg-red-600 font-medium shadow-md transition-all`}
              >
                🚨 Emergency Brake
              </button>
            )}
          </div>

          {/* Preset Scenarios */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Control Gain Presets:</label>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {Object.entries(PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    selectedPreset === key
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-300 dark:border-gray-600 hover:border-blue-300'
                  }`}
                >
                  <div className="font-medium text-sm">{preset.name}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Kp={preset.kp}, Kd={preset.kd}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Control Parameters */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <label className="w-40 text-sm font-medium">Target Speed:</label>
              <input
                type="range"
                min="0.1"
                max={MAX_SPEED}
                step="0.1"
                value={targetSpeed}
                onChange={(e) => setTargetSpeed(parseFloat(e.target.value))}
                className="flex-1"
              />
              <span className="w-20 text-right font-mono text-sm">
                {(targetSpeed * (1/SPEED_TO_PIXEL_RATIO)).toFixed(1)} m/s
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <label className="w-40 text-sm font-medium">Position Gain (K<sub>p</sub>):</label>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.1"
                value={kp}
                onChange={(e) => setKp(parseFloat(e.target.value))}
                className="flex-1"
              />
              <span className="w-20 text-right font-mono text-sm">{kp.toFixed(1)}</span>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <label className="w-40 text-sm font-medium">Velocity Gain (K<sub>d</sub>):</label>
              <input
                type="range"
                min="0.1"
                max="1.5"
                step="0.1"
                value={kd}
                onChange={(e) => setKd(parseFloat(e.target.value))}
                className="flex-1"
              />
              <span className="w-20 text-right font-mono text-sm">{kd.toFixed(1)}</span>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded text-xs">
              <strong>Fixed Parameters:</strong> d₀ = {MIN_SPACING}px, τ = {TIME_HEADWAY}s (constant time headway)
            </div>
          </div>
        </div>

        {/* Simulation Canvas */}
        <div className={`border-2 rounded-xl overflow-hidden shadow-xl mb-6 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gradient-to-b from-sky-100 to-gray-100 border-gray-300'}`}>
          <svg width="100%" height="240" viewBox="0 0 800 240" preserveAspectRatio="xMidYMid meet">
            {/* Sky gradient */}
            <defs>
              <linearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{stopColor: isDarkMode ? '#1e3a8a' : '#bae6fd', stopOpacity: 1}} />
                <stop offset="100%" style={{stopColor: isDarkMode ? '#0c4a6e' : '#e0f2fe', stopOpacity: 1}} />
              </linearGradient>
            </defs>
            <rect width="800" height="150" fill="url(#sky)" />

            {/* Road */}
            <rect y="150" width="800" height="90" fill={isDarkMode ? "#374151" : "#6b7280"} />
            <line x1="0" y1="150" x2="800" y2="150" stroke={isDarkMode ? "#666" : "#999"} strokeWidth="3" />

            {/* Road markings */}
            {Array.from({length: 10}, (_, i) => (
              <rect key={i} x={i * 100} y="193" width="40" height="4" fill="#fbbf24" />
            ))}

            {/* Background elements */}
            {elements.map(el => {
              const config = elementTypes[el.type];
              return config.type === 'streetlight' ? (
                <StreetLight key={el.id} x={el.x} isDarkMode={isDarkMode} />
              ) : (
                <BackgroundElement
                  key={el.id}
                  x={el.x}
                  isDarkMode={isDarkMode}
                  scale={el.scale || config.scale}
                  yOffset={config.yOffset}
                  type={config.type}
                />
              );
            })}

            {/* Vehicles */}
            {vehicles.map((vehicle, index) => (
              <Vehicle
                key={vehicle.id}
                x={vehicle.x}
                color={vehicle.color}
                velocity={vehicle.velocity}
                acceleration={vehicle.acceleration}
                desiredSpacing={vehicle.desiredSpacing}
                actualSpacing={vehicle.actualSpacing}
                isLeader={index === VEHICLE_COUNT - 1}
                isDarkMode={isDarkMode}
              />
            ))}
          </svg>
        </div>

        {/* Velocity History Chart */}
        {running && velocityHistory.length > 10 && (
          <div className="mb-6 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg">
            <div className="flex justify-center">
              <VelocityChart history={velocityHistory} isDarkMode={isDarkMode} />
            </div>
          </div>
        )}

        {/* Legend and Instructions */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
          <h3 className="font-bold text-lg mb-4">Mathematical Model</h3>

          <div className="space-y-4 text-sm">
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="font-semibold mb-2">Dynamics:</p>
              <code className="block">
                ẍ<sub>i</sub> = u<sub>i</sub>
              </code>
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                Each vehicle's acceleration equals its control input (unit mass assumed)
              </p>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="font-semibold mb-2">Control Law (Predecessor-Following):</p>
              <code className="block">
                u<sub>i</sub> = K<sub>p</sub>·(x<sub>i+1</sub> - x<sub>i</sub> - d*) - K<sub>d</sub>·(ẋ<sub>i</sub> - ẋ<sub>i+1</sub>)
              </code>
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                d* = {MIN_SPACING} + {TIME_HEADWAY}·ẋ<sub>i+1</sub> (constant time headway policy)
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Visual Indicators:</h4>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                  <li className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full bg-green-500"></span>
                    <span>Optimal spacing (|error| &lt; 10px)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full bg-red-500"></span>
                    <span>Too close (collision risk)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full bg-blue-500"></span>
                    <span>Too far (inefficient)</span>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Interpreting Results:</h4>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 text-xs">
                  <li>• <strong>String stable:</strong> Velocity oscillations decay along platoon</li>
                  <li>• <strong>String unstable:</strong> Oscillations amplify (see "Aggressive" preset)</li>
                  <li>• <strong>Higher K<sub>p</sub>:</strong> Faster response, risk of oscillations</li>
                  <li>• <strong>Higher K<sub>d</sub>:</strong> More damping, smoother response</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>
            Developed by <a href="/" className="text-blue-600 dark:text-blue-400 hover:underline">Dr. Andrés A. Peters</a> |
            Universidad Adolfo Ibáñez |
            <a href="https://github.com/Sapetor" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline ml-1">
              GitHub
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default EnhancedStringStabilityDemo;
