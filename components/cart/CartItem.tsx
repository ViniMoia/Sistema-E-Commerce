"use client";

import { Minus, Plus, Trash2 } from "lucide-react";

import { getOptimizedImageUrl } from "@/lib/utils";

interface CartItemProps {
  item: {
    id: string;
    variantID: string;
    productName: string;
    imageUrl: string;
    color: string;
    size: string;
    price: number;
    quantity: number;
  };
  onRemove: (variantID: string) => void;
  onUpdateQuantity: (variantID: string, quantity: number) => void;
  isLoading?: boolean;
}

export function CartItem({ item, onRemove, onUpdateQuantity, isLoading }: CartItemProps) {
  return (
    <div className="flex gap-4 group py-2">
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-none overflow-hidden bg-neutral-800 shrink-0 ring-1 ring-white/10">
        <img
          src={getOptimizedImageUrl(item.imageUrl, 150, 150)}
          alt={item.productName}
          className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110"
        />
      </div>

      <div className="flex flex-col flex-1 justify-between py-1">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-medium text-white tracking-tight">{item.productName}</h3>
            <p className="text-xs text-neutral-400 font-light mt-1">
              {item.color} / {item.size}
            </p>
          </div>
          <p className="font-mono text-white">
            ${(item.price * item.quantity).toFixed(2)}
          </p>
        </div>

        <div className="flex justify-between items-center mt-4">
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-full px-3 py-1">
            <button
              onClick={() => {
                if (item.quantity > 1) {
                  onUpdateQuantity(item.variantID, item.quantity - 1);
                } else {
                  onRemove(item.variantID);
                }
              }}
              disabled={isLoading}
              className="text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-sm font-mono w-4 text-center">{item.quantity}</span>
            <button
              onClick={() => onUpdateQuantity(item.variantID, item.quantity + 1)}
              disabled={isLoading}
              className="text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <button
            onClick={() => onRemove(item.variantID)}
            disabled={isLoading}
            className="text-neutral-500 hover:text-red-400 transition-colors flex items-center gap-2 text-xs uppercase tracking-widest disabled:opacity-50"
            aria-label="Remove item"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Remove</span>
          </button>
        </div>
      </div>
    </div>
  );
}


