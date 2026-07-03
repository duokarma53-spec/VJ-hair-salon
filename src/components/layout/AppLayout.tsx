import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppLayout() {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen w-full overflow-hidden text-white selection:bg-[#CD7F32]/20 font-sans p-4 gap-6 relative" style={{ background: '#0A0A0A' }}>
      
      {/* Ambient gold mesh background */}
      <div className="ambient-gold-mesh" />

      {/* Fixed Sidebar Container */}
      <div 
        className={`h-full shrink-0 relative z-10 transition-all duration-300 ease-in-out ${
          isSidebarOpen ? 'w-56 opacity-100 mr-0' : 'w-0 opacity-0 -ml-6 overflow-hidden'
        }`}
      >
        <div className="w-56 h-full">
          <Sidebar />
        </div>
      </div>

      {/* Main Content Container */}
      <div className="flex flex-1 flex-col h-full rounded-[24px] overflow-hidden relative z-10 transition-all duration-300 ease-in-out">
        <Header 
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
          isSidebarOpen={isSidebarOpen} 
        />
        
        <main className="flex-1 overflow-y-auto px-4 md:px-8 pb-12 pt-6 custom-scrollbar relative">
          <div className="mx-auto max-w-[1400px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 15, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.99 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
      
    </div>
  );
}

