"use client";

import React from "react";

export function WhatsAppButton({ phoneNumber }: { phoneNumber?: string | null }) {
  // Se não houver número configurado, o botão não será renderizado na tela.
  if (!phoneNumber) return null;

  // Limpa a string para ter certeza que tem apenas números na URL
  const cleanNumber = phoneNumber.replace(/\D/g, "");
  
  // Mensagem padrão amigável (pode ser alterada futuramente)
  const message = "Olá! Estou navegando na loja e gostaria de tirar uma dúvida.";
  const url = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;

  return (
    <div className="fixed bottom-6 right-6 z-[100] group animate-in fade-in slide-in-from-bottom-8 duration-700">
      <a 
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="relative flex items-center justify-center overflow-hidden rounded-full p-[2px] leading-none drop-shadow-[0_0_15px_rgba(37,211,102,0.15)]"
        aria-label="Fale conosco no WhatsApp"
      >
        {/* Shimmer Beam Animation Layer - Inspirado no Gemini 3 Animations */}
        <span 
          className="absolute inset-[-1000%] animate-spin bg-[conic-gradient(from_0deg,transparent_0_340deg,rgba(37,211,102,1)_360deg)]"
          style={{ animationDuration: '3s' }}
        ></span>
        
        {/* Base do Botão (Vazado/Escuro para não agredir a vista no Dark Mode) */}
        <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#050505] ring-1 ring-white/10 group-hover:bg-[#111] transition-colors duration-300">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="26" 
            height="26" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="#25D366" 
            strokeWidth="1.8" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className="group-hover:scale-110 group-hover:stroke-[2px] transition-all duration-300"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </span>
      </a>
    </div>
  );
}
