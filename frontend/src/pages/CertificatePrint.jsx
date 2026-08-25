import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCalibrationHistory, getDevice } from '../api/devices';
import './CertificatePrint.css';
import logoImg from '../assets/logo.png';

export default function CertificatePrint() {
  const { serialNumber, recordId } = useParams();
  const navigate = useNavigate();
  
  const [device, setDevice] = useState(null);
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [deviceData, historyData] = await Promise.all([
          getDevice(serialNumber),
          getCalibrationHistory(serialNumber)
        ]);
        
        setDevice(deviceData);
        
        const rec = historyData.find(r => r.id === Number(recordId));
        if (rec) {
          setRecord(rec);
        } else {
          console.error("Record not found!");
        }
      } catch (err) {
        console.error("Failed to load certificate data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [serialNumber, recordId]);

  useEffect(() => {
    if (!loading && device && record) {
      setTimeout(() => {
        window.print();
      }, 500); // Wait for rendering and image loading
    }
  }, [loading, device, record]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading Certificate...</div>;
  if (!device || !record) return <div style={{ padding: 40, textAlign: 'center' }}>Data not found.</div>;

  return (
    <div className="certificate-container">
      {/* Print Action Bar (Hidden when actually printing) */}
      <div className="no-print print-actions">
        <button className="btn-print" onClick={() => window.print()}>Print / Save as PDF</button>
        <button className="btn-close" onClick={() => navigate(-1)}>Close</button>
      </div>

      <div className="certificate-page">
        {/* Certificate Header */}
        <div className="cert-header">
          <div className="cert-logo-container">
            <img src={logoImg} alt="Adam International Hospital" className="cert-logo" />
          </div>
          <div className="cert-header-text">
            <h2>ADAM INTERNATIONAL HOSPITAL</h2>
            <p>Clinical Engineering Department</p>
            <h3>CALIBRATION CERTIFICATE</h3>
          </div>
          <div className="cert-meta">
            <p><strong>Cert No:</strong> {record.certificate_num || `AIH-CAL-${record.calibration_year}-${record.id}`}</p>
            <p><strong>Date Issued:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
            <p><strong>Session Year:</strong> {record.calibration_year}</p>
          </div>
        </div>

        {/* Device Information */}
        <div className="cert-section">
          <div className="cert-section-title">Equipment Information</div>
          <table className="cert-info-table">
            <tbody>
              <tr>
                <td><strong>Equipment Name:</strong></td>
                <td>{device.deviceType}</td>
                <td><strong>Serial Number:</strong></td>
                <td>{device.serialNumber}</td>
              </tr>
              <tr>
                <td><strong>Manufacturer:</strong></td>
                <td>{device.manufacturer || 'N/A'}</td>
                <td><strong>Model:</strong></td>
                <td>{device.model || 'N/A'}</td>
              </tr>
              <tr>
                <td><strong>Department:</strong></td>
                <td>{device.department || 'N/A'}</td>
                <td><strong>Accessory:</strong></td>
                <td>{record.accessory_type || 'Main Device'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Calibration Results */}
        <div className="cert-section">
          <div className="cert-section-title">Measurement Results</div>
          <table className="cert-results-table">
            <thead>
              <tr>
                <th>Test Parameter</th>
                <th>Reference Value</th>
                <th>Measured Value</th>
                <th>Tolerance Limits</th>
                <th>Deviation</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {record.tests && record.tests.length > 0 ? (
                record.tests.map(test => {
                  const isPass = Math.abs(test.actual_value - test.reference_value) <= Math.abs(test.max_value - test.reference_value);
                  return (
                    <tr key={test.id}>
                      <td>{test.test_label} {test.test_point_unit ? `(${test.test_point_unit})` : ''}</td>
                      <td>{test.reference_value}</td>
                      <td>{test.actual_value}</td>
                      <td>{test.min_value} ~ {test.max_value}</td>
                      <td>{test.deviation}</td>
                      <td className={isPass ? 'status-pass' : 'status-fail'}>{isPass ? 'PASS' : 'FAIL'}</td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center' }}>No test measurements recorded.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Overall Status */}
        <div className="cert-summary">
          <div className="summary-status">
            <strong>OVERALL STATUS:</strong> 
            <span className={record.result === 'Pass' ? 'status-pass large' : 'status-fail large'}>
              {record.result ? record.result.toUpperCase() : 'UNKNOWN'}
            </span>
          </div>
        </div>

        {/* Signatures */}
        <div className="cert-signatures">
          <div className="signature-box">
            <div className="sig-line"></div>
            <p>Calibrated By (Biomedical Engineer)</p>
          </div>
          <div className="signature-box">
            <div className="sig-line"></div>
            <p>Reviewed By (Clinical Engineering Manager)</p>
          </div>
        </div>
        
        <div className="cert-footer">
          <p>This certificate is issued electronically and remains valid until the next scheduled calibration date.</p>
        </div>
      </div>
    </div>
  );
}
