import { useState, useRef } from 'react';
import apiClient from '../api/client';
import './BulkImportModal.css';

const UploadIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="17 8 12 3 7 8"></polyline>
    <line x1="12" y1="3" x2="12" y2="15"></line>
  </svg>
);

const FileIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <line x1="16" y1="13" x2="8" y2="13"></line>
    <line x1="16" y1="17" x2="8" y2="17"></line>
    <polyline points="10 9 9 9 8 9"></polyline>
  </svg>
);

export default function BulkImportModal({ onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.csv') || droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls')) {
        setFile(droppedFile);
        setResult(null);
      } else {
        alert("Please upload a .csv or .xlsx file.");
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const downloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "serial_number,device_type,department,model,manufacturer,calibration_year,result,certificate_num,test_label,unit,reference_value,actual_value,min_value,max_value,deviation\n"
      + "DEFIB-101,Defibrillator,ICU,Zoll X,Zoll,2024,Pass,CERT-24-001,Output Energy,Joules,150,148,140,160,2\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "calibration_import_template.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setLoading(true);
    setResult(null);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiClient.post('/api/calibrations/bulk-upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        }
      });
      setResult(res.data);
      if (res.data.success && onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setResult({
        success: false,
        message: err.response?.data?.detail || "An error occurred during upload.",
        errors: []
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content bulk-import-modal">
        <div className="modal-header">
          <h2>Bulk Import Calibrations</h2>
          <button className="btn-close-modal" onClick={onClose} disabled={loading}>&times;</button>
        </div>
        
        <div className="modal-body">
          <p className="modal-desc">
            Upload an Excel (.xlsx) or CSV file to import multiple devices and calibration records at once.
          </p>

          <div className="template-download">
            <span>Don't have a file ready?</span>
            <button onClick={downloadTemplate} className="btn-link">Download Template (CSV)</button>
          </div>

          <div 
            className={`dropzone ${file ? 'has-file' : ''}`}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleFileChange}
            />
            {file ? (
              <div className="file-preview">
                <FileIcon />
                <span className="file-name">{file.name}</span>
                <span className="file-size">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
            ) : (
              <div className="dropzone-placeholder">
                <UploadIcon />
                <p><strong>Click to upload</strong> or drag and drop</p>
                <p className="file-types">.csv, .xlsx</p>
              </div>
            )}
          </div>

          {result && (
            <div className={`import-result ${result.success ? 'result-success' : 'result-error'}`}>
              <div className="result-header">
                <strong>{result.success ? 'Import Successful' : 'Import Failed'}</strong>
                <p>{result.message}</p>
              </div>
              
              {result.success && (
                <div className="result-stats">
                  <div className="stat"><span>{result.imported_devices}</span> Devices Created</div>
                  <div className="stat"><span>{result.imported_records}</span> Certificates Created</div>
                  <div className="stat"><span>{result.imported_tests}</span> Measurements Added</div>
                </div>
              )}
              
              {result.errors && result.errors.length > 0 && (
                <div className="result-errors">
                  <strong>Errors:</strong>
                  <ul>
                    {result.errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={loading}>
            {result?.success ? 'Close' : 'Cancel'}
          </button>
          {!result?.success && (
            <button className="btn btn-primary" onClick={handleUpload} disabled={!file || loading}>
              {loading ? 'Uploading...' : 'Upload & Process'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
