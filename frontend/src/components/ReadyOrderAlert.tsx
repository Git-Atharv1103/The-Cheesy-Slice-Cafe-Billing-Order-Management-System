import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useRealtime } from '../contexts/RealtimeContext';
import { Bell, CheckCircle, X, ArrowRight } from 'lucide-react';

export default function ReadyOrderAlert() {
  const { readyOrderNotification, dismissReadyNotification } = useRealtime();
  const navigate = useNavigate();

  if (!readyOrderNotification) return null;

  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-50 animate-bounce-once">
      <div className="bg-[#181818] border-2 border-green-500 rounded-2xl p-4 shadow-2xl text-white shadow-green-500/20 backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 text-green-400 flex items-center justify-center flex-shrink-0">
            <Bell size={22} className="animate-spin-slow" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="bg-green-500 text-black font-black text-xs px-2 py-0.5 rounded-full">
                READY
              </span>
              <h4 className="font-extrabold text-sm text-green-400">Order #{readyOrderNotification.daily_order_number} is Ready!</h4>
            </div>
            <p className="text-white font-bold text-sm mt-1 truncate">{readyOrderNotification.customer_name}</p>
            {readyOrderNotification.items && (
              <p className="text-gray-400 text-xs truncate mt-0.5">
                {readyOrderNotification.items.map(i => `${i.name} × ${i.quantity}`).join(', ')}
              </p>
            )}
          </div>

          <button
            onClick={dismissReadyNotification}
            className="text-gray-400 hover:text-white p-1 rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-3.5 pt-3 border-t border-[#2a2a2a] flex items-center justify-end gap-2 text-xs">
          <button
            onClick={dismissReadyNotification}
            className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white"
          >
            Dismiss
          </button>
          <button
            onClick={() => {
              const id = readyOrderNotification.id;
              dismissReadyNotification();
              navigate(`/orders/${id}`);
            }}
            className="flex items-center gap-1.5 bg-green-500 hover:bg-green-400 text-black font-extrabold px-3.5 py-1.5 rounded-xl transition-colors"
          >
            <span>View & Handover</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
