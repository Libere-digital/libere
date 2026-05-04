/**
 * Supabase Helper Functions for Library Operations
 *
 * This file contains reusable functions for interacting with
 * library-related tables in Supabase.
 */

import { supabase } from './supabase';
import type { Book } from '../core/interfaces/book.interface';

export interface BandungCollectionItem {
  id: number;
  title: string;
  author: string;
  description: string;
  cover_url: string;
  file_url: string;
  category: string;
  created_at: string;
}

/**
 * Get all books from bandung_collection table (always direct-access, no NFT required)
 */
export async function getBandungCollection(): Promise<BandungCollectionItem[]> {
  const { data, error } = await supabase
    .from('bandung_collection')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching bandung_collection:', error);
    return [];
  }

  return data || [];
}

export interface Library {
  id: number;
  name: string;
  address: string;
  description?: string;
  logo_url?: string;
  member_count?: number;
  book_count?: number;
  borrow_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface LibraryBook {
  id: number;
  library_id: number;
  book_id: number;
  is_visible: boolean;
  is_direct_access: boolean;
  added_at: string;
  last_synced: string;
}

/**
 * Get book IDs that are marked as direct access (no NFT/borrow required) for a library.
 * Returns a Set for O(1) lookup.
 */
export async function getDirectAccessBookIds(libraryId: number): Promise<Set<number>> {
  const { data, error } = await supabase
    .from('library_books')
    .select('book_id')
    .eq('library_id', libraryId)
    .eq('is_direct_access', true)
    .eq('is_visible', true);

  if (error) {
    console.error('Error fetching direct access books:', error);
    return new Set();
  }

  return new Set((data || []).map((row: any) => row.book_id));
}

/**
 * Get all libraries from database
 */
export async function getAllLibraries(): Promise<Library[]> {
  const { data, error } = await supabase
    .from('libraries')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching libraries:', error);
    throw new Error(`Failed to fetch libraries: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a single library by ID
 */
export async function getLibraryById(libraryId: number): Promise<Library | null> {
  const { data, error } = await supabase
    .from('libraries')
    .select('*')
    .eq('id', libraryId)
    .single();

  if (error) {
    console.error('Error fetching library:', error);
    throw new Error(`Failed to fetch library: ${error.message}`);
  }

  return data;
}

/**
 * Get a single library by contract address
 */
export async function getLibraryByAddress(address: string): Promise<Library | null> {
  const { data, error } = await supabase
    .from('libraries')
    .select('*')
    .eq('address', address)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows found
      return null;
    }
    console.error('Error fetching library by address:', error);
    throw new Error(`Failed to fetch library: ${error.message}`);
  }

  return data;
}

/**
 * Get all visible books for a library
 */
export async function getLibraryVisibleBooks(libraryId: number): Promise<Book[]> {
  const { data: libBooks, error: libError } = await supabase
    .from('library_books')
    .select('book_id')
    .eq('library_id', libraryId)
    .eq('is_visible', true);

  if (libError) {
    console.error('Error fetching library books:', libError);
    throw new Error(`Failed to fetch library books: ${libError.message}`);
  }

  const bookIds = (libBooks || []).map((row: any) => row.book_id);
  if (bookIds.length === 0) return [];

  const { data, error } = await supabase
    .from('Book')
    .select('*')
    .in('id', bookIds);

  if (error) {
    console.error('Error fetching books:', error);
    throw new Error(`Failed to fetch books: ${error.message}`);
  }

  return (data || []) as Book[];
}

/**
 * Get all books for a library (including hidden ones)
 */
export async function getAllLibraryBooks(libraryId: number): Promise<Book[]> {
  const { data, error } = await supabase
    .from('library_books')
    .select(`
      book_id,
      is_visible,
      Book (*)
    `)
    .eq('library_id', libraryId);

  if (error) {
    console.error('Error fetching all library books:', error);
    throw new Error(`Failed to fetch library books: ${error.message}`);
  }

  // Extract Book objects with visibility flag
  const books = (data || [])
    .map((item: any) => ({
      ...item.Book,
      is_visible: item.is_visible,
    }))
    .filter((book: any) => book.id !== null);

  return books;
}

/**
 * Get library_books records for a specific library
 */
export async function getLibraryBooksRecords(libraryId: number): Promise<LibraryBook[]> {
  const { data, error } = await supabase
    .from('library_books')
    .select('*')
    .eq('library_id', libraryId);

  if (error) {
    console.error('Error fetching library_books records:', error);
    throw new Error(`Failed to fetch library_books: ${error.message}`);
  }

  return data || [];
}

/**
 * Add a book to a library (initially hidden)
 */
export async function addBookToLibrary(
  libraryId: number,
  bookId: number,
  isVisible: boolean = false
): Promise<LibraryBook> {
  const { data, error } = await supabase
    .from('library_books')
    .insert({
      library_id: libraryId,
      book_id: bookId,
      is_visible: isVisible,
      last_synced: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding book to library:', error);
    throw new Error(`Failed to add book to library: ${error.message}`);
  }

  return data;
}

/**
 * Toggle book visibility in a library
 */
export async function toggleBookVisibility(
  libraryId: number,
  bookId: number,
  isVisible: boolean
): Promise<void> {
  const { error } = await supabase
    .from('library_books')
    .update({ is_visible: isVisible })
    .eq('library_id', libraryId)
    .eq('book_id', bookId);

  if (error) {
    console.error('Error toggling book visibility:', error);
    throw new Error(`Failed to update book visibility: ${error.message}`);
  }
}

/**
 * Bulk upsert library books (used for syncing)
 */
export async function upsertLibraryBooks(
  libraryId: number,
  bookIds: number[],
  isVisible: boolean = false
): Promise<void> {
  const insertData = bookIds.map(bookId => ({
    library_id: libraryId,
    book_id: bookId,
    is_visible: isVisible,
    last_synced: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('library_books')
    .upsert(insertData, {
      onConflict: 'library_id,book_id',
      ignoreDuplicates: false,
    });

  if (error) {
    console.error('Error upserting library books:', error);
    throw new Error(`Failed to upsert library books: ${error.message}`);
  }
}

/**
 * Update last_synced timestamp for library books
 */
export async function updateLastSynced(
  libraryId: number,
  bookIds: number[]
): Promise<void> {
  const { error } = await supabase
    .from('library_books')
    .update({ last_synced: new Date().toISOString() })
    .eq('library_id', libraryId)
    .in('book_id', bookIds);

  if (error) {
    console.error('Error updating last_synced:', error);
    throw new Error(`Failed to update last_synced: ${error.message}`);
  }
}

/**
 * Remove a book from a library
 */
export async function removeBookFromLibrary(
  libraryId: number,
  bookId: number
): Promise<void> {
  const { error } = await supabase
    .from('library_books')
    .delete()
    .eq('library_id', libraryId)
    .eq('book_id', bookId);

  if (error) {
    console.error('Error removing book from library:', error);
    throw new Error(`Failed to remove book from library: ${error.message}`);
  }
}

/**
 * Check if a book is visible in a library
 */
export async function isBookVisibleInLibrary(
  libraryId: number,
  bookId: number
): Promise<boolean> {
  const { data, error } = await supabase
    .from('library_books')
    .select('is_visible')
    .eq('library_id', libraryId)
    .eq('book_id', bookId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Book not in library
      return false;
    }
    console.error('Error checking book visibility:', error);
    return false;
  }

  return data?.is_visible || false;
}

/**
 * Get library statistics
 */
export async function getLibraryStats(libraryId: number): Promise<{
  totalBooks: number;
  visibleBooks: number;
  hiddenBooks: number;
}> {
  const { data, error } = await supabase
    .from('library_books')
    .select('is_visible')
    .eq('library_id', libraryId);

  if (error) {
    console.error('Error fetching library stats:', error);
    return { totalBooks: 0, visibleBooks: 0, hiddenBooks: 0 };
  }

  const totalBooks = data?.length || 0;
  const visibleBooks = data?.filter((b: any) => b.is_visible).length || 0;
  const hiddenBooks = totalBooks - visibleBooks;

  return { totalBooks, visibleBooks, hiddenBooks };
}
