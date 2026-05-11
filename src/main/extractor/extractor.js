const Seven = require('node-7z');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

// Archive file extensions to watch
const ARCHIVE_EXTENSIONS = ['.zip', '.rar', '.7z'];
const MULTIPART_PATTERNS = [
  /\.part\d+\.rar$/i,    // .part1.rar, .part2.rar, etc.
  /\.part\d+\.7z$/i,     // .part1.7z, .part2.7z, etc.
  /\.r\d+$/i,            // .r00, .r01, etc.
  /\.s\d+$/i,            // .s00, .s01, etc.
  /\.\d{3}$/i,           // .001, .002, etc.
];

/**
 * Archive extraction module with auto-detection and multi-part support
 */
class Extractor extends EventEmitter {
  /**
   * @param {Object} options
   * @param {string} [options.extractTo='subfolder'] - 'subfolder' | 'same' | 'custom'
   * @param {string} [options.customDir=null] - Custom extraction directory (if extractTo === 'custom')
   * @param {boolean} [options.deleteAfterExtract=false] - Delete archive after successful extraction
   * @param {Array<string>} [options.formats=['.zip', '.rar', '.7z']] - Supported formats
   */
  constructor(options = {}) {
    super();
    
    this.extractTo = options.extractTo || 'subfolder';
    this.customDir = options.customDir || null;
    this.deleteAfterExtract = options.deleteAfterExtract || false;
    this.formats = options.formats || ARCHIVE_EXTENSIONS;
  }
  
  /**
   * Check if a file is an archive based on extension
   */
  isArchive(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return this.formats.includes(ext);
  }
  
  /**
   * Check if a file is part of a multi-part archive
   */
  isMultipart(filePath) {
    const filename = path.basename(filePath);
    return MULTIPART_PATTERNS.some(pattern => pattern.test(filename));
  }
  
  /**
   * Find the first part of a multi-part archive
   * Looks for .part1.rar, .part01.rar, or the .rar file that starts the sequence
   */
  findMultipartFirst(filePath) {
    const dir = path.dirname(filePath);
    const filename = path.basename(filePath);
    const baseName = path.basename(filename, path.extname(filename));
    
    // Check for .part1.rar pattern
    const part1Pattern = /(.*)\.part(\d+)\.rar$/i;
    const match = filename.match(part1Pattern);
    
    if (match) {
      const base = match[1];
      const firstPart = `${base}.part1.rar`;
      const fullPath = path.join(dir, firstPart);
      
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
      
      // Try .part01.rar, .part001.rar, etc.
      for (let i = 1; i <= 999; i++) {
        const padded = `${base}.part${String(i).padStart(2, '0')}.rar`;
        const testPath = path.join(dir, padded);
        if (fs.existsSync(testPath)) {
          return testPath;
        }
      }
    }
    
    // Check for .r00 pattern (first part is the main .rar file)
    if (/\.r\d+$/i.test(filename)) {
      const mainRar = path.join(dir, `${baseName}.rar`);
      if (fs.existsSync(mainRar)) {
        return mainRar;
      }
    }
    
    // Check for .001 pattern
    if (/\.\d{3}$/i.test(filename) && !filename.endsWith('.001')) {
      const baseWithoutExt = filename.replace(/\.\d{3}$/i, '');
      const firstPart = path.join(dir, `${baseWithoutExt}.001`);
      if (fs.existsSync(firstPart)) {
        return firstPart;
      }
    }
    
    // If it's a .rar file and there are .r00, .r01 files nearby, this is the first part
    if (filename.endsWith('.rar')) {
      const files = fs.readdirSync(dir);
      const hasRFiles = files.some(f => /\.r\d+$/i.test(f));
      if (hasRFiles) {
        return filePath; // The .rar file is the first part
      }
    }
    
    // Not a multipart file or first part not found
    return null;
  }
  
  /**
   * Check if all parts of a multi-part archive exist
   */
  checkAllPartsExist(firstPartPath) {
    const dir = path.dirname(firstPartPath);
    const filename = path.basename(firstPartPath);
    
    // Detect the pattern
    const part1Match = filename.match(/(.*)\.part(\d+)\.rar$/i);
    if (part1Match) {
      const base = part1Match[1];
      // Check sequentially until a part is missing
      let partNum = 1;
      while (true) {
        const partPath = path.join(dir, `${base}.part${partNum}.rar`);
        if (!fs.existsSync(partPath)) {
          // Try zero-padded
          const paddedPath = path.join(dir, `${base}.part${String(partNum).padStart(2, '0')}.rar`);
          if (!fs.existsSync(paddedPath)) {
            break;
          }
        }
        partNum++;
      }
      return partNum - 1; // Number of parts found
    }
    
    // For .rar with .r00, .r01 files
    if (filename.endsWith('.rar')) {
      const files = fs.readdirSync(dir);
      const baseWithoutExt = path.basename(filename, '.rar');
      let rCount = 0;
      for (let i = 0; i < 100; i++) {
        const rFile = `${baseWithoutExt}.r${String(i).padStart(2, '0')}`;
        if (files.includes(rFile)) {
          rCount++;
        } else {
          break;
        }
      }
      return rCount + 1; // +1 for the main .rar
    }
    
    // For .001, .002 files
    const numExtMatch = filename.match(/(.*)\.(\d{3})$/i);
    if (numExtMatch) {
      const base = numExtMatch[1];
      let numCount = 0;
      for (let i = 1; i <= 999; i++) {
        const numPath = path.join(dir, `${base}.${String(i).padStart(3, '0')}`);
        if (fs.existsSync(numPath)) {
          numCount++;
        } else {
          break;
        }
      }
      return numCount;
    }
    
    // Single file
    return 1;
  }
  
  /**
   * Determine extraction destination
   */
  getDestination(archivePath) {
    const filename = path.basename(archivePath);
    const dir = path.dirname(archivePath);
    
    // Strip archive extensions to get base name
    let baseName = filename
      .replace(/\.zip$/i, '')
      .replace(/\.7z$/i, '')
      .replace(/\.part\d+\.rar$/i, '')
      .replace(/\.part\d{2,}\.rar$/i, '')
      .replace(/\.rar$/i, '')
      .replace(/\.\d{3}$/i, '');
    
    // Remove trailing dot if any
    baseName = baseName.replace(/\.+$/, '');
    
    switch (this.extractTo) {
      case 'subfolder':
        return path.join(dir, baseName);
      
      case 'same':
        return dir;
      
      case 'custom':
        return this.customDir || path.join(dir, baseName);
      
      default:
        return path.join(dir, baseName);
    }
  }
  
  /**
   * Extract an archive
   * @param {string} archivePath - Path to the archive file
   * @param {Object} [options]
   * @param {string} [options.destination] - Override extraction destination
   * @param {boolean} [options.deleteAfterExtract] - Override delete setting
   * @returns {Promise<{success: boolean, extractedFiles?: string[], destination?: string, error?: string}>}
   */
  async extract(archivePath, options = {}) {
    const destination = options.destination || this.getDestination(archivePath);
    const deleteAfter = options.deleteAfterExtract !== undefined 
      ? options.deleteAfterExtract 
      : this.deleteAfterExtract;
    
    // Validate archive exists
    if (!fs.existsSync(archivePath)) {
      return { success: false, error: `File not found: ${archivePath}` };
    }
    
    // Check if it's a multipart archive and find first part
    let actualArchivePath = archivePath;
    if (this.isMultipart(archivePath)) {
      const firstPart = this.findMultipartFirst(archivePath);
      if (!firstPart) {
        return { success: false, error: `Could not find first part of multipart archive: ${archivePath}` };
      }
      
      // Check all parts exist
      const partCount = this.checkAllPartsExist(firstPart);
      if (partCount < 2) {
        return { success: false, error: `Multipart archive appears incomplete: ${archivePath}` };
      }
      
      console.error(`[extractor] Detected multipart archive with ${partCount} parts`);
      actualArchivePath = firstPart;
    }
    
    // Create destination directory
    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true });
    }
    
    console.error(`[extractor] Extracting: ${actualArchivePath} → ${destination}`);
    this.emit('extracting', { archive: actualArchivePath, destination });
    
    return new Promise((resolve) => {
      const sevenInstance = Seven.extractFull(actualArchivePath, {
        destination,
        $progress: true,
        recursive: true,
      });
      
      sevenInstance.on('progress', (progress) => {
        this.emit('progress', {
          archive: actualArchivePath,
          percent: progress.percent || 0,
          fileCount: progress.fileCount || 0,
          file: progress.file || null,
        });
      });
      
      sevenInstance.on('end', (output) => {
        console.error(`[extractor] Extraction complete: ${output.length} entries`);
        
        const extractedFiles = output.map(entry => entry.file).filter(Boolean);
        
        // Delete archive if configured
        if (deleteAfter) {
          this.deleteArchiveAndParts(actualArchivePath);
        }
        
        this.emit('complete', {
          archive: actualArchivePath,
          destination,
          extractedFiles,
          fileCount: extractedFiles.length,
        });
        
        resolve({
          success: true,
          extractedFiles,
          destination,
          fileCount: extractedFiles.length,
        });
      });
      
      sevenInstance.on('error', (error) => {
        console.error(`[extractor] Extraction error: ${error.message}`);
        
        this.emit('error', {
          archive: actualArchivePath,
          error: error.message,
        });
        
        resolve({
          success: false,
          error: error.message,
        });
      });
    });
  }
  
  /**
   * Delete archive file and all its parts
   */
  deleteArchiveAndParts(archivePath) {
    try {
      const dir = path.dirname(archivePath);
      const filename = path.basename(archivePath);
      const files = fs.readdirSync(dir);
      
      // Detect the base name pattern
      let basePattern = null;
      
      // For .part1.rar pattern
      const partMatch = filename.match(/(.*)\.part\d+\.rar$/i);
      if (partMatch) {
        basePattern = partMatch[1];
        const toDelete = files.filter(f => 
          f.startsWith(basePattern) && (/\.part\d+\.rar$/i.test(f) || /\.part\d{2,}\.rar$/i.test(f))
        );
        for (const f of toDelete) {
          fs.unlinkSync(path.join(dir, f));
          console.error(`[extractor] Deleted: ${f}`);
        }
        return;
      }
      
      // For .rar with .r00, .r01 pattern
      const rarMatch = filename.match(/(.*)\.rar$/i);
      if (rarMatch) {
        const base = rarMatch[1];
        const toDelete = files.filter(f => 
          f === `${base}.rar` || /\.r\d{2,}$/i.test(f)
        );
        for (const f of toDelete) {
          fs.unlinkSync(path.join(dir, f));
          console.error(`[extractor] Deleted: ${f}`);
        }
        return;
      }
      
      // For .001, .002 pattern
      const numMatch = filename.match(/(.*)\.\d{3}$/i);
      if (numMatch) {
        const base = numMatch[1];
        const toDelete = files.filter(f => 
          f.startsWith(`${base}.`) && /\.\d{3}$/i.test(f)
        );
        for (const f of toDelete) {
          fs.unlinkSync(path.join(dir, f));
          console.error(`[extractor] Deleted: ${f}`);
        }
        return;
      }
      
      // Single file deletion
      if (fs.existsSync(archivePath)) {
        fs.unlinkSync(archivePath);
        console.error(`[extractor] Deleted: ${filename}`);
      }
    } catch (error) {
      console.error(`[extractor] Failed to delete archive: ${error.message}`);
    }
  }
  
  /**
   * Watch a directory for completed downloads and auto-extract
   * @param {string} dir - Directory to watch
   * @param {Function} filterFn - Optional filter function (filePath) => boolean
   */
  watchDirectory(dir, filterFn = null) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    console.error(`[extractor] Watching directory: ${dir}`);
    
    fs.watch(dir, async (eventType, filename) => {
      if (eventType !== 'rename') {
        return; // Only care about new files
      }
      
      if (!filename) return;
      
      const filePath = path.join(dir, filename);
      
      // Wait a moment for file to be fully written
      await this.sleep(2000);
      
      // Check if file still exists (might have been moved)
      if (!fs.existsSync(filePath)) return;
      
      // Check if it's an archive
      if (!this.isArchive(filePath) && !this.isMultipart(filePath)) {
        return;
      }
      
      // Apply custom filter
      if (filterFn && !filterFn(filePath)) {
        return;
      }
      
      console.error(`[extractor] Detected new archive: ${filename}`);
      this.emit('detected', { path: filePath, filename });
      
      // For multipart, wait until all parts exist
      if (this.isMultipart(filePath)) {
        const firstPart = this.findMultipartFirst(filePath);
        if (!firstPart) return;
        
        const partCount = this.checkAllPartsExist(firstPart);
        if (partCount < 2) {
          console.error(`[extractor] Waiting for all parts of multipart archive...`);
          return; // Wait for more parts
        }
        
        // Extract from first part
        await this.extract(firstPart);
      } else {
        await this.extract(filePath);
      }
    });
  }
  
  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { Extractor };
