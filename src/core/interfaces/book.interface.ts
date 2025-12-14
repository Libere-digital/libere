export interface Book {
    id: number;
    title: string;
    description: string;
    author: string;
    publisher: string;
    metadataUri: string;
    epub: string;
    priceEth: string;
    royalty: number;
    addressReciepent: string;
    addressRoyaltyRecipient: string;
    quantity?: number; // Jumlah NFT yang dimiliki (optional, hanya ada di bookshelf)
    fileType?: 'epub' | 'pdf'; // File type: EPUB or PDF (optional, defaults to 'epub' for backward compatibility)
    audiobook?: string; // URL to audiobook file (MP3) - optional
    category?: string; // Book category/genre (e.g., Fiksi, Non-Fiksi, Sejarah) - optional
    donated_by?: string; // Name of company/organization that donated this book - optional
    donated_at?: string; // ISO timestamp when the book was donated - optional
}