# 📤 CSV Upload - Quick Reference

## Constraints at a Glance

| Constraint | Value | Where Enforced |
|------------|-------|-----------------|
| **Max File Size** | 50MB | Frontend + Backend (Multer) |
| **Supported Format** | .csv only | Frontend + Backend filter |
| **Empty Files** | Not allowed | Frontend + Backend |
| **File Limit** | One at a time | Frontend UI |

---

## User Flow

### Normal Upload Flow
```
1. User selects or drags CSV file
   ↓
2. Frontend validates (size, extension, empty check)
   ↓
3. If valid → Show confirmation dialog with file info
   ↓
4. User clicks "Confirm Upload"
   ↓
5. File sent to backend
   ↓
6. Backend validates again
   ↓
7. Upload processes
   ↓
8. Success message with statistics shown
```

### If Validation Fails
```
1. User selects invalid file
   ↓
2. Frontend shows specific error message
   ↓
3. File NOT uploaded
   ↓
4. User can select correct file
```

---

## Error Messages You Might See

| Error | What It Means | Solution |
|-------|---------------|----------|
| "Invalid file format..." | Not a .csv file | Select a .csv file |
| "File size exceeds 50MB..." | File too large | Choose a smaller file |
| "File is empty..." | Selected file has no data | Choose a file with data |
| "CSV file is required" | No file selected | Try again |

---

## Confirmation Dialog

### Shows Before Upload
- File name
- File size in KB
- Format confirmation
- Space usage (X.XXMB / 50MB)
- What will happen (create/update table, skip duplicates)

### Two Buttons
- **Cancel**: Doesn't upload, clears selection
- **Confirm Upload**: Proceeds with upload

---

## After Successful Upload

Success screen shows:
- ✓ Upload Successful message
- Table name that was created/updated
- Statistics:
  - Rows in CSV (total)
  - Inserted (new rows added)
  - Skipped duplicates (rows that already existed)

---

## Technical Details

### Frontend Validation (JavaScript)
Location: `frontend/src/pages/UploadPage.jsx`

Checks:
```
✓ File extension ends with .csv
✓ File size ≤ 50MB (bytes comparison)
✓ File not empty (size > 0)
```

### Backend Validation (Node.js)
Location: `backend/src/controllers/uploadController.js`

Checks:
```
✓ Multer size limit (50MB)
✓ File filter (extension + MIME type)
✓ File exists
✓ Extension validation
✓ Not empty validation
✓ Size validation (redundant check)
```

### Error Handling
Location: `backend/src/app.js`

Special handling for:
```
- LIMIT_FILE_SIZE → Status 413 (Too Large)
- LIMIT_FIELD_SIZE → Status 413
- MulterError → Status 400
- Other errors → Appropriate status code
```

---

## Configuration Constants

### Frontend (`UploadPage.jsx`)
```javascript
maxFileSize: 50 * 1024 * 1024 // 50MB in bytes
allowedExtensions: ['.csv']
maxFileSizeMB: 50 // For display
```

### Backend (`uploadController.js`)
```javascript
maxFileSize: 50 * 1024 * 1024 // 50MB
allowedMimeTypes: [
  'text/csv',
  'application/vnd.ms-excel',
  'application/octet-stream'
]
maxFileSizeMB: 50
```

---

## How to Change Limits

### To increase max file size to 100MB:

**Frontend:**
```javascript
// In UploadPage.jsx
maxFileSize: 100 * 1024 * 1024
maxFileSizeMB: 100
```

**Backend:**
```javascript
// In uploadController.js
maxFileSize: 100 * 1024 * 1024
maxFileSizeMB: 100
```

---

## Testing Checklist

✅ **Test with valid CSV**
- Select .csv file < 50MB
- See confirmation dialog
- Confirm upload
- See success message

✅ **Test with invalid format**
- Select .xlsx or .json
- See error message
- File not uploaded

✅ **Test with large file**
- Try file > 50MB
- See size error
- File not uploaded

✅ **Test with empty file**
- Create empty .csv
- Select it
- See error
- File not uploaded

✅ **Test cancel**
- Select file
- Confirm dialog appears
- Click Cancel
- Dialog closes, file cleared

---

## File Support

### Supported
- ✅ CSV files (.csv)
- ✅ Standard comma-separated format
- ✅ Excel CSV exports
- ✅ Text-based CSV files

### Not Supported
- ❌ Excel files (.xlsx, .xls)
- ❌ JSON files (.json)
- ❌ XML files (.xml)
- ❌ Binary formats
- ❌ Compressed files (.zip, .rar)

---

## Size Examples

| File Type | ~Size | Status |
|-----------|-------|--------|
| 1,000 rows × 10 cols | 100KB | ✅ Upload |
| 10,000 rows × 10 cols | 1MB | ✅ Upload |
| 100,000 rows × 10 cols | 10MB | ✅ Upload |
| 1,000,000 rows × 5 cols | 40MB | ✅ Upload |
| 2,000,000 rows × 5 cols | 80MB | ❌ Too large |

---

## Security Features

✅ **Multiple validation layers** (frontend + backend)
✅ **File size limits** prevent DoS attacks
✅ **Extension validation** prevents malicious uploads
✅ **MIME type checking** adds extra security
✅ **User confirmation** prevents accidental uploads
✅ **Clear error messages** help users fix issues

---

## Responsive Design

### Desktop (768px+)
- Modal: 500px wide
- Full spacing
- Regular button sizes

### Mobile (<768px)
- Modal: Full width with padding
- Compact spacing
- Touch-friendly buttons
- Readable text sizes

---

## Files Modified/Created

### Modified
- ✏️ `frontend/src/pages/UploadPage.jsx` - Added validation & dialog
- ✏️ `frontend/src/App.css` - Added modal styles
- ✏️ `backend/src/controllers/uploadController.js` - Added constraints
- ✏️ `backend/src/app.js` - Enhanced error handling

### Created
- 📄 `CSV_UPLOAD_CONSTRAINTS.md` - Full documentation
- 📄 This file - Quick reference

---

## API Response Status Codes

| Code | Meaning | Reason |
|------|---------|--------|
| 200 | Success | Upload successful |
| 400 | Bad Request | Invalid format, missing file, empty file |
| 413 | Too Large | File exceeds size limit |
| 500 | Server Error | Processing error |

---

## Browser Compatibility

✅ All modern browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

Features used:
- File API
- FormData
- Fetch API
- CSS Grid/Flexbox
- CSS Animations

---

## Performance Notes

- Upload is **asynchronous** (doesn't block UI)
- Frontend validation is **instant**
- No network calls for validation
- Backend processes stream efficiently
- Memory-based storage (no temp files)

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "File format invalid" | Ensure file has .csv extension |
| "File too large" | Split file into smaller parts |
| "Upload fails at backend" | Check network, file permissions |
| "Can't see confirmation dialog" | Check browser console for errors |
| "Size shows wrong" | Refresh page, try different file |

---

## Next Steps

1. **Test the upload** with your CSV files
2. **Review error messages** - they're informative
3. **Check success statistics** - verify data imported
4. **Read full docs** if you need more details (`CSV_UPLOAD_CONSTRAINTS.md`)

---

**Last Updated**: April 2026  
**For Help**: Check `CSV_UPLOAD_CONSTRAINTS.md` or source code comments

