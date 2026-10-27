import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useRealtime } from '../contexts/RealtimeContext';
import { Bell, X, ArrowRight } from 'lucide-react';

export default function ReadyOrderAlert() {
  const { readyOrderNotification, dismissReadyNotification } = useRealtime();
  const navigate = useNavigate();

  if (!readyOrderNotification) return null;

  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-50 animate-bounce-once">
      <div className="bg-white border-2 border-emerald-500 rounded-2xl p-4 shadow-2xl text-gray-900 backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <Bell size={22} className="animate-spin-slow" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500 text-white font-black text-xs px-2 py-0.5 rounded-full shadow-xs">
                READY
              </span>
              <h4 className="font-extrabold text-sm text-emerald-700">Order #{readyOrderNotification.daily_order_number} is Ready!</h4>
            </div>
            <p className="text-gray-900 font-bold text-sm mt-1 truncate">{readyOrderNotification.customer_name}</p>
            {readyOrderNotification.items && (
              <p className="text-gray-500 text-xs truncate mt-0.5">
                {readyOrderNotification.items.map(i => `${i.name} × ${i.quantity}`).join(', ')}
              </p>
            )}
          </div>

          <button
            onClick={dismissReadyNotification}
            className="text-gray-400 hover:text-gray-700 p-1 rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-3.5 pt-3 border-t border-gray-100 flex items-center justify-end gap-2 text-xs">
          <button
            onClick={dismissReadyNotification}
            className="px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-800 font-medium"
          >
            Dismiss
          </button>
          <button
            onClick={() => {
              const id = readyOrderNotification.id;
              dismissReadyNotification();
              navigate(`/orders/${id}`);
            }}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3.5 py-1.5 rounded-xl transition-colors shadow-sm"
          >
            <span>View & Handover</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
