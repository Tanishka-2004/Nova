// ──────────────────────────────────────────────────────────────
// StyleNova Product Catalog
// D2C Fashion & Beauty brand — seed data
// ──────────────────────────────────────────────────────────────

export interface Product {
  name: string
  category: string
  basePrice: number // INR
}

export const products: Product[] = [
  // ─── Tops ──────────────────────────────────────────────────
  { name: 'Classic White Cotton Tee', category: 'Tops', basePrice: 699 },
  { name: 'Oversized Graphic Print Tee', category: 'Tops', basePrice: 899 },
  { name: 'Striped Boat Neck Top', category: 'Tops', basePrice: 799 },
  { name: 'Embroidered Peasant Blouse', category: 'Tops', basePrice: 1299 },
  { name: 'Satin Cami Top', category: 'Tops', basePrice: 999 },
  { name: 'Cropped Ribbed Knit Top', category: 'Tops', basePrice: 749 },
  { name: 'Linen Button-Down Shirt', category: 'Tops', basePrice: 1499 },

  // ─── Dresses ───────────────────────────────────────────────
  { name: 'Floral Print Midi Dress', category: 'Dresses', basePrice: 1999 },
  { name: 'Solid A-Line Kurta Dress', category: 'Dresses', basePrice: 1499 },
  { name: 'Wrap Dress in Teal', category: 'Dresses', basePrice: 2299 },
  { name: 'Cotton Maxi Sundress', category: 'Dresses', basePrice: 1799 },
  { name: 'Bodycon Ribbed Mini Dress', category: 'Dresses', basePrice: 1299 },
  { name: 'Tiered Ruffle Dress', category: 'Dresses', basePrice: 2499 },
  { name: 'Denim Shirt Dress', category: 'Dresses', basePrice: 1899 },

  // ─── Jeans ─────────────────────────────────────────────────
  { name: 'Classic Slim Fit Jeans', category: 'Jeans', basePrice: 1799 },
  { name: 'High-Waist Wide Leg Jeans', category: 'Jeans', basePrice: 1999 },
  { name: 'Distressed Boyfriend Jeans', category: 'Jeans', basePrice: 2199 },
  { name: 'Straight Leg Raw Hem Jeans', category: 'Jeans', basePrice: 1899 },
  { name: 'Skinny Ankle-Length Jeans', category: 'Jeans', basePrice: 1699 },
  { name: 'Mom Fit Light Wash Jeans', category: 'Jeans', basePrice: 1999 },

  // ─── Accessories ───────────────────────────────────────────
  { name: 'Rose Gold Hoop Earrings', category: 'Accessories', basePrice: 599 },
  { name: 'Beaded Layered Necklace', category: 'Accessories', basePrice: 799 },
  { name: 'Silk Printed Scarf', category: 'Accessories', basePrice: 999 },
  { name: 'Leather Braided Belt', category: 'Accessories', basePrice: 699 },
  { name: 'Oversized Cat-Eye Sunglasses', category: 'Accessories', basePrice: 1299 },
  { name: 'Pearl Stud Earrings', category: 'Accessories', basePrice: 499 },
  { name: 'Statement Chunky Bracelet', category: 'Accessories', basePrice: 899 },

  // ─── Footwear ──────────────────────────────────────────────
  { name: 'White Canvas Sneakers', category: 'Footwear', basePrice: 1999 },
  { name: 'Block Heel Sandals', category: 'Footwear', basePrice: 1599 },
  { name: 'Kolhapuri Leather Flats', category: 'Footwear', basePrice: 1299 },
  { name: 'Embellished Juttis', category: 'Footwear', basePrice: 999 },
  { name: 'Platform Espadrille Wedges', category: 'Footwear', basePrice: 2499 },
  { name: 'Strappy Stiletto Heels', category: 'Footwear', basePrice: 2999 },

  // ─── Bags ──────────────────────────────────────────────────
  { name: 'Structured Tote Bag', category: 'Bags', basePrice: 2499 },
  { name: 'Mini Crossbody Sling Bag', category: 'Bags', basePrice: 1499 },
  { name: 'Woven Jute Beach Bag', category: 'Bags', basePrice: 999 },
  { name: 'Quilted Chain Clutch', category: 'Bags', basePrice: 1799 },
  { name: 'Canvas Laptop Tote', category: 'Bags', basePrice: 2199 },
  { name: 'Bucket Bag in Tan', category: 'Bags', basePrice: 1899 },

  // ─── Skincare ──────────────────────────────────────────────
  { name: 'Vitamin C Brightening Serum', category: 'Skincare', basePrice: 899 },
  { name: 'Hyaluronic Acid Moisturizer', category: 'Skincare', basePrice: 749 },
  { name: 'SPF 50 Lightweight Sunscreen', category: 'Skincare', basePrice: 599 },
  { name: 'Niacinamide Pore Minimizer', category: 'Skincare', basePrice: 699 },
  { name: 'Rose Water Toner Mist', category: 'Skincare', basePrice: 499 },
  { name: 'Retinol Night Cream', category: 'Skincare', basePrice: 1199 },
  { name: 'Kumkumadi Tailam Face Oil', category: 'Skincare', basePrice: 1499 },
  { name: 'Charcoal Clay Mask', category: 'Skincare', basePrice: 599 },
]
