import React from 'react';

interface DonutChartProps {
    botPercentage: number;
    agentPercentage: number;
    totalAnswered: number;
}

const DonutChart: React.FC<DonutChartProps> = ({ botPercentage, agentPercentage, totalAnswered }) => {
    const radius = 50;
    const strokeWidth = 15;
    const circumference = 2 * Math.PI * radius;

    const botSegment = (circumference * botPercentage) / 100;
    const agentSegment = (circumference * agentPercentage) / 100;

    const botRotation = -90;
    const agentRotation = -90 + (botPercentage * 3.6);

    return (
        <div className="relative w-full max-w-xs sm:max-w-xs md:max-w-sm lg:max-w-md xl:max-w-lg mx-auto">
            <svg className="w-full h-full" viewBox="0 0 120 120">
                {/* Background Circle */}
                <circle
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="none"
                    strokeWidth={strokeWidth}
                    className="stroke-gray-700"
                />

                {/* Bot Segment */}
                {botSegment > 0 && (
                    <circle
                        cx="60"
                        cy="60"
                        r={radius}
                        fill="none"
                        strokeWidth={strokeWidth}
                        strokeDasharray={`${botSegment} ${circumference}`}
                        // Removed strokeLinecap="round"
                        className="stroke-green-500"
                        style={{ transform: `rotate(${botRotation}deg)`, transformOrigin: '50% 50%' }}
                    />
                )}

                {/* Agent Segment */}
                {agentSegment > 0 && (
                    <circle
                        cx="60"
                        cy="60"
                        r={radius}
                        fill="none"
                        strokeWidth={strokeWidth}
                        strokeDasharray={`${agentSegment} ${circumference}`}
                        // Removed strokeLinecap="round"
                        className="stroke-blue-500"
                        style={{ transform: `rotate(${agentRotation}deg)`, transformOrigin: '50% 50%' }}
                    />
                )}

                {/* Percentage Labels Removed */}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-bold text-white">{totalAnswered}</span>
                <span className="text-base text-gray-400">Answered</span>
            </div>
        </div>
    );
};

export default DonutChart;