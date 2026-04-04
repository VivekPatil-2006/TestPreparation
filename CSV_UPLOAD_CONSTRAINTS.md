# CSV File Upload Constraints & Confirmation System

## Overview
The CSV file upload feature now includes comprehensive client-side and server-side validation, along with a confirmation dialog before upload. This ensures only valid files are uploaded and provides users with clear feedback about constraints and actions.

---

## 📋 Upload Constraints

### File Size Limits
- **Maximum File Size**: 50MB
- **Enforced At**: Frontend validation & Multer server-side limit
- **Error Message**: If file exceeds limit, user sees clear KB/MB breakdown

### Supported File Formats
- **Accepted Format**: `.csv` (CSV files only)
- **MIME Types**: 
  - `text/csv`
  - `application/vnd.ms-excel`
  - `application/octet-stream` (fallback for some CSV files)
- **Validation Points**: 
  - Filename extension check (.csv)
  - MIME type validation
  - Multer fileFilter function

### File Requirements
- ✅ File must not be empty (0 bytes)
- ✅ File must have .csv extension
- ✅ File must be readable/valid CSV format
- ✅ File size must be ≤ 50MB
- ✅ Must contain actual data rows

---

## 🔍 Validation Flow

### Frontend Validation (Frontend/React)
Located in: `frontend/src/pages/UploadPage.jsx`

```
User Selects File
    ↓
1. Check file extension (.csv)
    ↓ If invalid → Show error, stop
2. Check file size (≤ 50MB)
    ↓ If too large → Show error, stop
3. Check file is not empty (> 0 bytes)
    ↓ If empty → Show error, stop
4. All checks pass → Show confirmation dialog
```

**Error Messages Displayed:**
- `"Invalid file format. Please upload a CSV file. Supported formats: .csv"`
- `"File size exceeds the maximum limit of 50MB. Your file is X.XXMB."`
- `"File is empty. Please select a file with data."`

### Backend Validation (Node.js/Express)
Located in: `backend/src/controllers/uploadController.js`

```
Server Receives Request
    ↓
1. Multer checks file size (limit: 50MB)
    ↓ If too large → Error 413 (Payload Too Large)
2. Multer fileFilter validates extension
    ↓ If invalid → Error 400 (Bad Request)
3. Controller checks file exists
    ↓ If missing → Error 400
4. Controller validates extension again
    ↓ If invalid → Error 400
5. Controller checks file not empty
    ↓ If empty → Error 400
6. Controller validates size again
    ↓ If too large → Error 413
7. Process CSV upload
    ↓ Success or processing error
```

---

## 💬 Confirmation Dialog

### When It Appears
- ✅ Only when file passes **all validation checks**
- ✅ Before the actual upload begins
- ✅ Gives user chance to review file details

### What User Sees

#### File Information Card
Shows:
- File icon (📄)
- File name
- File size in KB
- Visual confirmation of selected file

#### Upload Details
Shows:
- File format confirmation: "CSV (Comma-Separated Values)"
- File size vs. allowed maximum: "X.XXMB / 50MB allowed"
- Action description: "Create/update table from file name, import all rows"

#### Warning/Information
Shows:
- "Duplicate rows will be automatically skipped"
- Processing will create or update a database table

#### Action Buttons
- **Cancel Button**: Cancels upload, clears file selection
- **Confirm Upload Button**: Proceeds with upload
- **Close (X)**: Same as Cancel

### Accessibility Features
- Keyboard navigable
- Clear focus states
- Semantic HTML
- Proper ARIA labels
- Screen reader friendly

---

## 🎯 Constants Reference

### Frontend Constants
File: `frontend/src/pages/UploadPage.jsx`

```javascript
const UPLOAD_CONSTRAINTS = {
  maxFileSize: 50 * 1024 * 1024, // 50MB in bytes
  allowedExtensions: ['.csv'],
  maxFileSizeMB: 50,
};
```

### Backend Constants
File: `backend/src/controllers/uploadController.js`

```javascript
const UPLOAD_CONSTRAINTS = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedMimeTypes: ['text/csv', 'application/vnd.ms-excel', 'application/octet-stream'],
  maxFileSizeMB: 50,
};
```

---

## 🖼️ UI Components

### Constraints Info Display
- Location: Below upload browse button
- Text: "Maximum file size: 50MB • Supported format: CSV"
- Style: Gray text, helps users understand constraints upfront

### Confirmation Modal
- **Size**: Max 500px wide (responsive)
- **Animation**: Slide-up with fade-in backdrop
- **Position**: Center of screen, fixed overlay
- **Dismissible**: Yes (cancel button or X)

### Error Messages
- **Style**: Red background with darker red text
- **Location**: Below upload zone
- **Clearable**: Automatically clears on new file selection
- **Specific Messages**: Different for each constraint violation

### Success Message
- **Message**: "✓ Upload Successful"
- **Shows**: Upload summary with statistics
  - Table name created/updated
  - Total rows in CSV
  - Rows inserted
  - Duplicate rows skipped

---

## 🔒 Security Measures

### Frontend Security
- ✅ File extension validation
- ✅ File size pre-check
- ✅ MIME type indication
- ✅ User confirmation required
- ✅ Clear error messages

### Backend Security
- ✅ Multer file size limit enforcement
- ✅ File extension validation in fileFilter
- ✅ MIME type validation
- ✅ Additional controller-level validation
- ✅ Proper HTTP status codes
- ✅ Error handling for all edge cases

### Attack Prevention
- ✅ **File Size DoS**: Limited to 50MB
- ✅ **Invalid File Upload**: Extension + MIME validation
- ✅ **Empty File**: Explicit empty check
- ✅ **Type Confusion**: Multiple validation layers
- ✅ **Malicious CSV**: Handled by CSV parser (sql injection protection)

---

## 📱 Responsive Design

### Desktop (≥768px)
- Full modal width up to 500px
- Normal button sizes (48px)
- All information visible
- Two-column layout in footer

### Tablet/Mobile (<768px)
- Modal takes up available width with padding
- Touch-friendly button sizes (44px)
- Stacked layout
- Smaller fonts for space efficiency
- No animations on low-power devices (optional)

---

## 🧪 Testing Scenarios

### Valid Upload
1. Select valid CSV file (< 50MB)
2. See confirmation dialog
3. Confirm upload
4. See success message with stats
✅ **Expected**: Upload completes successfully

### File Too Large
1. Select file > 50MB
2. See error: "File size exceeds the maximum limit..."
3. File not selected
✅ **Expected**: Upload blocked

### Invalid File Type
1. Select non-CSV file (.xlsx, .json, etc.)
2. See error: "Invalid file format..."
3. File not selected
✅ **Expected**: Upload blocked

### Empty File
1. Create empty .csv file
2. Select file
3. See error: "File is empty..."
4. File not selected
✅ **Expected**: Upload blocked

### Cancel Upload
1. Select valid file
2. See confirmation dialog
3. Click "Cancel"
4. Dialog closes, file cleared
✅ **Expected**: No upload occurs

### Confirm Upload
1. Select valid file
2. See confirmation dialog
3. Click "Confirm Upload"
4. See loading state
5. See success message
✅ **Expected**: Upload completes

---

## ⚙️ Configuration

### Modifying Constraints

#### Change Max File Size
Frontend: `frontend/src/pages/UploadPage.jsx`
```javascript
const UPLOAD_CONSTRAINTS = {
  maxFileSize: 100 * 1024 * 1024, // Change to 100MB
  allowedExtensions: ['.csv'],
  maxFileSizeMB: 100, // Update display value
};
```

Backend: `backend/src/controllers/uploadController.js`
```javascript
const UPLOAD_CONSTRAINTS = {
  maxFileSize: 100 * 1024 * 1024, // Change to 100MB
  allowedMimeTypes: [...],
  maxFileSizeMB: 100, // Update display value
};
```

#### Allow Multiple File Types
Backend: `backend/src/controllers/uploadController.js`
```javascript
const UPLOAD_CONSTRAINTS = {
  maxFileSize: 50 * 1024 * 1024,
  allowedMimeTypes: ['text/csv', 'application/vnd.ms-excel', 'application/json'],
  maxFileSizeMB: 50,
};
// Also update fileFilter logic
```

---

## 📊 User Experience Flow

```
Start
  ├─ User drags file or clicks browse
  ├─ File selected
  ├─ Frontend validates
  │  ├─ Extension? ✓
  │  ├─ Size? ✓
  │  └─ Empty? ✓
  ├─ Show confirmation dialog
  │  ├─ File info display
  │  ├─ Upload details
  │  └─ Action buttons
  ├─ User confirms
  ├─ Frontend sends to backend
  ├─ Backend validates again
  ├─ Multer processes
  ├─ Controller validates
  ├─ CSV parsed & uploaded
  ├─ Success response
  ├─ Show confirmation with stats
  └─ End
```

---

## 🐛 Error Handling

### Frontend Errors (Preventive)
| Error | Cause | Action |
|-------|-------|--------|
| Invalid extension | File not .csv | Show error, clear |
| File too large | Size > 50MB | Show error with size info |
| File empty | 0 bytes | Show error, require new file |

### Backend Errors (Defensive)
| Status | Error | Reason |
|--------|-------|--------|
| 400 | Invalid format | Extension or MIME mismatch |
| 400 | File is empty | Size = 0 bytes |
| 413 | Size exceeds | File > 50MB limit |
| 500 | Processing error | CSV parse/DB error |

---

## 📝 Code References

### Frontend Files
- **Main Logic**: `frontend/src/pages/UploadPage.jsx`
- **Styles**: `frontend/src/App.css` (modal styles)
- **Constants**: Defined in UploadPage.jsx

### Backend Files
- **Controller**: `backend/src/controllers/uploadController.js`
- **Routes**: `backend/src/routes/uploadRoutes.js`
- **Error Handling**: `backend/src/app.js`
- **Service**: `backend/src/services/uploadService.js`

### Configuration Files
- **Tailwind**: `frontend/tailwind.config.js`
- **Multer Setup**: In uploadController.js

---

## 🎨 CSS Classes Used

### Modal Components
- `.modal-overlay` - Dark background overlay
- `.modal-content` - Modal container
- `.confirmation-modal` - Specific modal type
- `.modal-header` - Header section
- `.modal-body` - Content section
- `.modal-footer` - Footer with buttons

### File Information
- `.file-info-card` - File details card
- `.file-info-icon` - File type icon
- `.file-info-details` - File name and metadata
- `.file-name` - Filename text
- `.file-meta` - File size and info

### Form Elements
- `.btn-primary` - Main action button
- `.btn-secondary` - Cancel button
- `.upload-constraints-info` - Constraints display

---

## ✨ Future Enhancements

1. **Multiple File Upload**
   - Allow selecting multiple CSV files at once
   - Process sequentially or in parallel
   - Show progress for each file

2. **File Preview**
   - Show first N rows before upload
   - Allow column mapping
   - Data validation preview

3. **Drag & Drop Improvements**
   - Show preview as files are dragged
   - Support multiple files in drop
   - Visual feedback during drag

4. **Advanced Validation**
   - Column header validation
   - Data type checking
   - Duplicate row detection pre-upload

5. **Batch Upload**
   - Template for batch uploads
   - Scheduled uploads
   - Upload history tracking

6. **Storage Options**
   - Choose between local/cloud storage
   - Different backends support
   - Archive uploaded files

---

## 📊 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Apr 2026 | Initial implementation |
| - | - | Frontend validation |
| - | - | Confirmation dialog |
| - | - | Backend constraints |
| - | - | Error handling |
| - | - | Documentation |

---

## 💡 Best Practices

### For Users
- ✅ Keep CSV files under 20MB for faster uploads
- ✅ Ensure CSV format is valid before upload
- ✅ Check file name before confirming upload
- ✅ Wait for success message before leaving page
- ✅ Review upload statistics for accuracy

### For Developers
- ✅ Keep constraints synchronized frontend/backend
- ✅ Test with edge case files
- ✅ Monitor error logs for validation failures
- ✅ Update documentation when changing limits
- ✅ Maintain security validation layers

---

## 📞 Support

For issues or questions:
1. Check error message displayed
2. Review this documentation
3. Check browser console for details
4. Verify file format/size
5. Contact development team if issue persists

---

**Last Updated**: April 2026  
**Version**: 1.0  
**Status**: ✅ Production Ready

