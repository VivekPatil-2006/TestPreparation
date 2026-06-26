import { useState } from 'react';

// File upload constraints
const UPLOAD_CONSTRAINTS = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedExtensions: ['.csv'],
  maxFileSizeMB: 50,
};

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const CSV_TEMPLATE_HEADERS = ['question', 'option1', 'option2', 'option3', 'option4', 'answer'];
const CSV_TEMPLATE_ROWS = [
  ['What is 2 + 2?', '1', '2', '3', '4', '4'],
  ['Which language runs in the browser?', 'Python', 'C++', 'JavaScript', 'Java', 'JavaScript'],
  ['What does CPU stand for?', 'Central Process Unit', 'Central Processing Unit', 'Computer Personal Unit', 'Control Processing Unit', 'Central Processing Unit'],
];

function UploadPage({ onUploadComplete }) {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [scannedRows, setScannedRows] = useState(0);
  const [totalRows, setTotalRows] = useState(0);

  const validateFile = (selectedFile) => {
    if (!selectedFile) {
      return { valid: false, error: 'No file selected.' };
    }

    // Check file extension
    const fileName = selectedFile.name.toLowerCase();
    const isValidExtension = UPLOAD_CONSTRAINTS.allowedExtensions.some((ext) =>
      fileName.endsWith(ext)
    );

    if (!isValidExtension) {
      return {
        valid: false,
        error: `Invalid file format. Please upload a CSV file. Supported formats: ${UPLOAD_CONSTRAINTS.allowedExtensions.join(', ')}`,
      };
    }

    // Check file size
    if (selectedFile.size > UPLOAD_CONSTRAINTS.maxFileSize) {
      return {
        valid: false,
        error: `File size exceeds the maximum limit of ${UPLOAD_CONSTRAINTS.maxFileSizeMB}MB. Your file is ${(selectedFile.size / (1024 * 1024)).toFixed(2)}MB.`,
      };
    }

    // Check file is not empty
    if (selectedFile.size === 0) {
      return {
        valid: false,
        error: 'File is empty. Please select a file with data.',
      };
    }

    return { valid: true, error: null };
  };

  const handleFileSelection = (selectedFile) => {
    setResult(null);
    setError('');

    if (!selectedFile) {
      setFile(null);
      return;
    }

    // Validate file
    const validation = validateFile(selectedFile);

    if (!validation.valid) {
      setError(validation.error);
      setFile(null);
      return;
    }

    // File is valid, set it and show confirmation dialog
    setFile(selectedFile);
    setPendingFile(selectedFile);
    setShowConfirmDialog(true);
  };

  const handleConfirmUpload = async () => {
    if (!pendingFile) {
      return;
    }

    setShowConfirmDialog(false);
    setError('');
    setLoading(true);
    setUploadProgress(0);
    setUploadStatus('Preparing upload...');
    setUploadSpeed(0);
    setScannedRows(0);
    setTotalRows(0);

    try {
      const formData = new FormData();
      formData.append('file', pendingFile);
      const startTime = Date.now();

      // Use XMLHttpRequest to track upload progress
      const response = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        let parsedOffset = 0;
        let pendingBuffer = '';

        const tryParseJson = (text) => {
          if (!text) {
            return null;
          }

          try {
            return JSON.parse(text);
          } catch {
            return null;
          }
        };

        // Track upload progress
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percentComplete);

            // Calculate upload speed (KB/s) and guard against divide by zero.
            const elapsedSeconds = Math.max((Date.now() - startTime) / 1000, 0.001);
            const speedKBps = (event.loaded / 1024 / elapsedSeconds).toFixed(2);
            setUploadSpeed(speedKBps);

            if (percentComplete < 30) {
              setUploadStatus('Preparing...');
            } else if (percentComplete < 60) {
              setUploadStatus('Uploading...');
            } else if (percentComplete < 90) {
              setUploadStatus('Processing...');
            } else {
              setUploadStatus('Finalizing...');
            }
          }
        });

        // Read streamed processing progress from backend.
        xhr.addEventListener('progress', () => {
          const chunk = xhr.responseText.slice(parsedOffset);
          if (!chunk) {
            return;
          }

          parsedOffset = xhr.responseText.length;
          pendingBuffer += chunk;

          const lines = pendingBuffer.split('\n');
          pendingBuffer = lines.pop() || '';

          lines.forEach((line) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) {
              return;
            }

            const payload = tryParseJson(trimmedLine);
            if (!payload) {
              return;
            }

            if (payload.type === 'progress') {
              if (typeof payload.totalRows === 'number') {
                setTotalRows(payload.totalRows);
              }
              if (typeof payload.scannedCount === 'number') {
                setScannedRows(payload.scannedCount);
              }

              setUploadStatus('Scanning rows...');
            }

            if (payload.type === 'error') {
              reject(new Error(payload.message || 'Upload failed'));
            }

            if (payload.type === 'complete' && payload.result) {
              resolve(payload.result);
            }
          });
        });

        // Handle completion
        xhr.addEventListener('load', () => {
          if (xhr.status < 200 || xhr.status >= 300) {
            const parsedBody = tryParseJson(xhr.responseText);
            reject(new Error(parsedBody?.message || `Upload failed with status ${xhr.status}`));
            return;
          }

          if (pendingBuffer.trim()) {
            const finalPayload = tryParseJson(pendingBuffer.trim());
            if (finalPayload?.type === 'complete' && finalPayload.result) {
              resolve(finalPayload.result);
              return;
            }

            if (finalPayload?.type === 'error') {
              reject(new Error(finalPayload.message || 'Upload failed'));
              return;
            }
          }

          const parsedBody = tryParseJson(xhr.responseText);

          if (xhr.status >= 200 && xhr.status < 300) {
            if (parsedBody?.type === 'complete' && parsedBody.result) {
              resolve(parsedBody.result);
              return;
            }

            if (parsedBody) {
              resolve(parsedBody);
              return;
            }

            reject(new Error('Unexpected server response format. Expected JSON.'));
            return;
          }

          reject(new Error(parsedBody?.message || `Upload failed with status ${xhr.status}`));
        });

        // Handle errors
        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'));
        });

        // Get token from localStorage
        const token = localStorage.getItem('authToken');
        xhr.open('POST', `${API_BASE_URL}/upload/csv?progress=1`);
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        xhr.send(formData);
      });

      setUploadProgress(100);
      setUploadStatus('Complete!');
      setScannedRows(response.totalRowsInCsv || scannedRows);
      setTotalRows(response.totalRowsInCsv || totalRows);
      setTimeout(() => {
        setResult(response);
        setFile(null);
        setPendingFile(null);
        setUploadProgress(0);
        setUploadStatus('');
        setScannedRows(0);
        setTotalRows(0);
        if (onUploadComplete) {
          onUploadComplete();
        }
      }, 500);
    } catch (err) {
      setError(err.message || 'Upload failed');
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelUpload = () => {
    setShowConfirmDialog(false);
    setPendingFile(null);
    setFile(null);
    setError('');
  };

  const escapeCsvValue = (value) => {
    const text = String(value == null ? '' : value);
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const handleDownloadTemplate = () => {
    const lines = [
      CSV_TEMPLATE_HEADERS.map(escapeCsvValue).join(','),
      ...CSV_TEMPLATE_ROWS.map((row) => row.map(escapeCsvValue).join(',')),
    ];

    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mcq_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="upload-page">
      <div className="upload-title-row">
        <div className="upload-title-block">
          <h1>Upload CSV</h1>
          <p>Import question data from CSV files</p>
        </div>

        <button type="button" className="upload-template-btn" onClick={handleDownloadTemplate}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 15V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M8 11L12 15L16 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 19H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>Download CSV Template</span>
        </button>
      </div>

      <div
        className={dragActive ? 'upload-dropzone drag-active' : 'upload-dropzone'}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragActive(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          const droppedFile = event.dataTransfer.files?.[0] || null;
          handleFileSelection(droppedFile);
        }}
      >
        <div className="upload-dropzone-center">
          <div className="upload-dropzone-icon" aria-hidden="true">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 16V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M8 9L12 5L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 16V19H20V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <h3>{loading ? 'Uploading your CSV file...' : 'Drag & drop your CSV file'}</h3>
          <p>or click to browse</p>

          <label className="upload-browse-btn" htmlFor="upload-csv-input">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 3H14L18 7V21H6V3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              <path d="M14 3V7H18" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              <path d="M9 12L11 10L15 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Browse files</span>
          </label>

          <p className="upload-constraints-info">
            Maximum file size: {UPLOAD_CONSTRAINTS.maxFileSizeMB}MB • Supported format: CSV
          </p>
        </div>

        <input
          id="upload-csv-input"
          className="upload-native-input"
          type="file"
          accept=".csv"
          onChange={(event) => handleFileSelection(event.target.files?.[0] || null)}
          disabled={loading}
        />
      </div>

      {file ? <p className="upload-file-label">Selected file: {file.name}</p> : null}

      {loading && uploadProgress > 0 ? (
        <div className="upload-progress-container">
          <div className="upload-progress-header">
            <span className="upload-progress-label">{uploadStatus}</span>
            <span className="upload-progress-percentage">{uploadProgress}%</span>
          </div>
          <div className="upload-progress-bar">
            <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }} />
          </div>
          <div className="upload-progress-footer">
            <span className="upload-progress-speed">Speed: {uploadSpeed} KB/s</span>
            <span className="upload-progress-size">
              {file ? `${(file.size / 1024).toFixed(2)} KB` : ''}
            </span>
          </div>
          {totalRows > 0 ? (
            <div className="upload-progress-scan-count">
              Scanned {scannedRows} out of {totalRows} rows
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <div className="error-banner">{error}</div> : null}

      {result ? (
        <div className="upload-result upload-summary">
          <div>
            <h4>✓ Upload Successful</h4>
            <p>Table: {result.tableName}</p>
          </div>
          <div className="upload-stats">
            <p>Rows in CSV: {result.totalRowsInCsv}</p>
            <p>Inserted: {result.insertedCount}</p>
            <p>Skipped duplicates: {result.skippedDuplicates}</p>
          </div>
        </div>
      ) : null}

      {/* Confirmation Dialog */}
      {showConfirmDialog && pendingFile && (
        <div className="modal-overlay">
          <div className="modal-content confirmation-modal">
            <div className="modal-header">
              <h2>Confirm File Upload</h2>
              <button
                className="modal-close"
                onClick={handleCancelUpload}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="file-info-card">
                <div className="file-info-icon">📄</div>
                <div className="file-info-details">
                  <p className="file-name">{pendingFile.name}</p>
                  <p className="file-meta">
                    Size: {(pendingFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>

              <div className="confirmation-message">
                <h3>Ready to upload?</h3>
                <p>
                  This will create or update a database table with the data from your CSV file. 
                  Duplicate rows will be automatically skipped.
                </p>
              </div>

              <div className="upload-details-box">
                <p className="detail-item">
                  <strong>File Format:</strong> CSV (Comma-Separated Values)
                </p>
                <p className="detail-item">
                  <strong>File Size:</strong> {(pendingFile.size / (1024 * 1024)).toFixed(2)}MB / {UPLOAD_CONSTRAINTS.maxFileSizeMB}MB allowed
                </p>
                <p className="detail-item">
                  <strong>Action:</strong> Create/update table from file name, import all rows
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={handleCancelUpload}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleConfirmUpload}
                disabled={loading}
              >
                {loading ? 'Uploading...' : 'Confirm Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default UploadPage;
