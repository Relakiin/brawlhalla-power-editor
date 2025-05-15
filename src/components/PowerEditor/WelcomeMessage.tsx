import React from "react";

const WelcomeMessage: React.FC = () => {
  return (
    <div className="grid grid-cols-3 items-center justify-center h-full">
      <div className="text-center p-4 border border-gray-300 rounded-lg col-start-2">
      <h2 className="text-xl font-bold mb-2">Welcome</h2>
      <p className="text-gray-400">Click on the "Load File" button to load your power list.</p>
      </div>
    </div>
  );
};

export default WelcomeMessage;