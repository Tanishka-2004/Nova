import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as Indian Rupees
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a number with commas (Indian numbering)
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-IN").format(num);
}

/**
 * Format a date relative to now
 */
export function formatRelativeDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Format a date in a readable format
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Calculate percentage
 */
export function percentage(part: number, total: number): string {
  if (total === 0) return "0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

/**
 * RFM tier color mapping
 */
export function getRfmTierColor(tier: string): string {
  const colors: Record<string, string> = {
    CHAMPION: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    LOYAL: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    POTENTIAL: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    AT_RISK: "text-orange-400 bg-orange-400/10 border-orange-400/20",
    LOST: "text-red-400 bg-red-400/10 border-red-400/20",
  };
  return colors[tier] || "text-gray-400 bg-gray-400/10 border-gray-400/20";
}

/**
 * Campaign status color mapping
 */
export function getCampaignStatusColor(status: string): string {
  const colors: Record<string, string> = {
    DRAFT: "text-gray-400 bg-gray-400/10 border-gray-400/20",
    SCHEDULED: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    SENDING: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    SENT: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    COMPLETED: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  };
  return colors[status] || "text-gray-400 bg-gray-400/10 border-gray-400/20";
}

/**
 * Channel icon mapping
 */
export function getChannelIcon(channel: string): string {
  const icons: Record<string, string> = {
    WHATSAPP: "📱",
    SMS: "💬",
    EMAIL: "📧",
    RCS: "✨",
  };
  return icons[channel] || "📨";
}
