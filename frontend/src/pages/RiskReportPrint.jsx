import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDeviceRiskDetails } from '../api/risk';
import './RiskReportPrint.css';
import logoImg from '../assets/logo.png';

const RISK_CLASS_BADGE_STYLES = {
  CLASS_1: { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0', label: 'Class 1 (Low Risk - منخفض الخطورة)' },
  CLASS_2: { bg: '#fffbeb', text: '#92400e', border: '#fde68a', label: 'Class 2 (Medium Risk - متوسط الخطورة)' },
  CLASS_3: { bg: '#fef2f2', text: '#991b1b', border: '#fecaca', label: 'Class 3 (High Criticality - عالي الخطورة)' },
};

const CAL_RISK_BADGE_STYLES = {
  LOW: { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' },
  MEDIUM: { bg: '#fff7ed', text: '#9a3412', border: '#ffedd5' },
  HIGH: { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
};

export default function RiskReportPrint() {
  const { serialNumber } = useParams();
  const navigate = useNavigate();

  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const realTimeDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const realTimeClock = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const currentDateTimeFormatted = `${realTimeDate} ${realTimeClock}`;

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const data = await getDeviceRiskDetails(serialNumber);
        if (!data) {
          setError(`Device with serial number "${serialNumber}" not found.`);
        } else {
          setDetails(data);
        }
      } catch (err) {
        console.error('Failed to load risk report details:', err);
        setError('Failed to load equipment risk data. Please check connection.');
      } finally {
        setLoading(false);
      }
    }
    if (serialNumber) {
      loadData();
    }
  }, [serialNumber]);

  if (loading) {
    return (
      <div className="risk-print-container">
        <div className="risk-print-loading">
          <div className="risk-print-spinner"></div>
          <p>Generating Medical Equipment Risk Assessment Report...</p>
        </div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="risk-print-container">
        <div className="risk-print-error">
          <h3>Unable to Load Risk Report</h3>
          <p>{error || 'No data found for this equipment.'}</p>
          <button className="btn-close" onClick={() => navigate(-1)}>Go Back</button>
        </div>
      </div>
    );
  }

  const { device, equipment_risk, calibration_risk, calibration_prediction, recommendations } = details;
  const riskBadge = RISK_CLASS_BADGE_STYLES[equipment_risk.risk_class] || RISK_CLASS_BADGE_STYLES.CLASS_1;
  const calBadge = CAL_RISK_BADGE_STYLES[calibration_risk.calibration_risk_level] || CAL_RISK_BADGE_STYLES.LOW;

  return (
    <div className="risk-print-container">
      {/* Action Toolbar (hidden when printing) */}
      <div className="no-print risk-print-actions">
        <button className="btn-print" onClick={() => window.print()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"></polyline>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
            <rect x="6" y="14" width="12" height="8"></rect>
          </svg>
          Print / Save as PDF
        </button>
        <button className="btn-close" onClick={() => navigate(-1)}>
          Close
        </button>
      </div>

      {/* Printable Document (A4 Pages) */}
      <div className="risk-report-document">
        {/* Header */}
        <div className="report-header">
          <div className="report-logo-container">
            <img src={logoImg} alt="Adam International Hospital" className="report-logo" />
          </div>
          <div className="report-header-titles">
            <h2>ADAM INTERNATIONAL HOSPITAL</h2>
            <p className="sub-title">Clinical Engineering & Medical Technology Department</p>
            <h3>EQUIPMENT RISK ASSESSMENT & SAFETY EVALUATION REPORT</h3>
            <p className="arabic-sub">تقرير تقييم المخاطر وتصنيف الأجهزة الطبية</p>
          </div>
          <div className="report-meta">
            <p><strong>Report Ref:</strong> AIH-RSK-{device.serial_number}</p>
            <p><strong>Date Generated:</strong> {currentDateTimeFormatted}</p>
            <p><strong>Status:</strong> Official Assessment</p>
          </div>
        </div>

        {/* Section 1: Equipment Identification */}
        <div className="report-section">
          <div className="report-section-header">
            <span>1. Equipment Identification & Asset Metadata</span>
            <span className="section-header-ar">بيانات الجهاز والتعريف</span>
          </div>
          <table className="report-data-table">
            <tbody>
              <tr>
                <td className="lbl">Equipment Type:</td>
                <td className="val"><strong>{device.device_type}</strong></td>
                <td className="lbl">Serial Number:</td>
                <td className="val highlight"><strong>{device.serial_number}</strong></td>
              </tr>
              <tr>
                <td className="lbl">Department:</td>
                <td className="val">{device.department || 'Clinical Department'}</td>
                <td className="lbl">Arabic Designation:</td>
                <td className="val arabic-text">{equipment_risk.arabic_name || 'غير محدد'}</td>
              </tr>
              <tr>
                <td className="lbl">Manufacturer:</td>
                <td className="val">{device.manufacturer || 'Standard'}</td>
                <td className="lbl">Model:</td>
                <td className="val">{device.model || 'Standard'}</td>
              </tr>
              <tr>
                <td className="lbl">Resolution:</td>
                <td className="val">{device.resolution !== null && device.resolution !== undefined ? device.resolution : 'Standard'}</td>
                <td className="lbl">Evaluation Standard:</td>
                <td className="val">ISO 13485 / AIH Clinical Risk Matrix</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 2: Equipment Risk Classification */}
        <div className="report-section">
          <div className="report-section-header">
            <span>2. Equipment Risk Classification & Scoring</span>
            <span className="section-header-ar">تقييم وتصنيف درجة خطورة الجهاز</span>
          </div>

          <div className="risk-score-overview">
            <div className="risk-badge-box" style={{ backgroundColor: riskBadge.bg, color: riskBadge.text, borderColor: riskBadge.border }}>
              <span className="badge-title">OFFICIAL RISK CLASSIFICATION:</span>
              <span className="badge-class">{riskBadge.label}</span>
            </div>
            <div className="risk-metric-cards">
              <div className="metric-box">
                <span className="m-val">{equipment_risk.risk_percentage}%</span>
                <span className="m-lbl">Overall Risk Percentage</span>
              </div>
              <div className="metric-box">
                <span className="m-val">{equipment_risk.equipment_risk}</span>
                <span className="m-lbl">Calculated Risk Score</span>
              </div>
              <div className="metric-box">
                <span className="m-val">{equipment_risk.probability_occurrence}</span>
                <span className="m-lbl">Probability Factor</span>
              </div>
            </div>
          </div>

          <table className="report-data-table">
            <thead>
              <tr>
                <th>Evaluation Parameter</th>
                <th>Assigned Value</th>
                <th>Scale / Maximum</th>
                <th>Clinical Interpretation</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Process Impact Risk (تأثير العملية)</strong></td>
                <td><strong>{equipment_risk.process_risk}</strong></td>
                <td>Level 1 to 3</td>
                <td>
                  {equipment_risk.process_risk === 3
                    ? 'High: Complete workflow interruption / vital unit shutdown.'
                    : equipment_risk.process_risk === 2
                    ? 'Medium: Partial delay or diagnostic disruption.'
                    : 'Low: Routine device; minimal workflow disruption.'}
                </td>
              </tr>
              <tr>
                <td><strong>Patient Impact Risk (تأثير المريض)</strong></td>
                <td><strong>{equipment_risk.patient_risk}</strong></td>
                <td>Level 1 to 3</td>
                <td>
                  {equipment_risk.patient_risk === 3
                    ? 'High: Critical life-support / direct hazard to patient life.'
                    : equipment_risk.patient_risk === 2
                    ? 'Medium: Diagnostic measurement / indirect patient impact.'
                    : 'Low: Non-contact or supportive device.'}
                </td>
              </tr>
              <tr>
                <td><strong>Equipment Availability Ratio</strong></td>
                <td><strong>{equipment_risk.equipment_count} present / {equipment_risk.minimum_required} min</strong></td>
                <td>Count vs. Target</td>
                <td>
                  {equipment_risk.equipment_count < equipment_risk.minimum_required
                    ? 'Deficit: Present count is below minimum required hospital threshold.'
                    : 'Adequate: Present inventory meets required clinical department baseline.'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 3: Calibration Performance & Drift History */}
        <div className="report-section">
          <div className="report-section-header">
            <span>3. Calibration Performance & Predictive Drift Analysis</span>
            <span className="section-header-ar">أداء المعايرة ومؤشرات الانحراف التنبؤي</span>
          </div>

          <table className="report-data-table">
            <tbody>
              <tr>
                <td className="lbl">Calibration Risk Indicator:</td>
                <td className="val">
                  <span className="cal-risk-pill" style={{ backgroundColor: calBadge.bg, color: calBadge.text, borderColor: calBadge.border }}>
                    {calibration_risk.calibration_risk_level} CALIBRATION RISK
                  </span>
                </td>
                <td className="lbl">Failure Rate:</td>
                <td className="val">
                  <strong>{calibration_risk.calibration_failure_rate !== null ? `${calibration_risk.calibration_failure_rate}%` : '0%'}</strong>
                </td>
              </tr>
              <tr>
                <td className="lbl">Calibration History:</td>
                <td className="val">{calibration_risk.total_calibrations} Total Visits ({calibration_risk.passed_calibrations} Passed, {calibration_risk.failed_calibrations} Failed)</td>
                <td className="lbl">Test Measurements:</td>
                <td className="val">{calibration_risk.total_tests} Tests ({calibration_risk.failed_tests} Out of Tolerance)</td>
              </tr>
              <tr>
                <td className="lbl">Max Absolute Deviation:</td>
                <td className="val">{calibration_risk.max_deviation !== null ? calibration_risk.max_deviation : 'N/A'}</td>
                <td className="lbl">Average Deviation:</td>
                <td className="val">{calibration_risk.avg_deviation !== null ? calibration_risk.avg_deviation : 'N/A'}</td>
              </tr>
              <tr>
                <td className="lbl">Predicted Calibration Date:</td>
                <td className="val"><strong>{calibration_prediction.predicted_next_calibration || 'Annual'}</strong></td>
                <td className="lbl">Schedule Status:</td>
                <td className="val">
                  <strong className={calibration_prediction.status === 'OVERDUE' ? 'status-fail' : calibration_prediction.status === 'DUE SOON' ? 'status-warn' : 'status-pass'}>
                    {calibration_prediction.status} ({calibration_prediction.days_remaining < 0 ? `${Math.abs(calibration_prediction.days_remaining)} days overdue` : `${calibration_prediction.days_remaining} days remaining`})
                  </strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 4: Maintenance Protocols & Actions */}
        <div className="report-section">
          <div className="report-section-header">
            <span>4. Clinical Engineering Maintenance Protocols</span>
            <span className="section-header-ar">بروتوكولات الصيانة والإجراءات التصحيحية</span>
          </div>

          <div className="protocol-blocks">
            <div className="protocol-card">
              <h5>Recommended General Action (الإجراء الموصى به)</h5>
              <p>{equipment_risk.recommended_action || 'Execute scheduled periodic calibration and routine safety inspection.'}</p>
            </div>
            <div className="protocol-card">
              <h5>Preventive Maintenance Protocol (الصيانة الوقائية)</h5>
              <p>{equipment_risk.preventive_action || 'Perform electrical safety testing, visual probe verification, and manufacturer-recommended recalibration.'}</p>
            </div>
            <div className="protocol-card">
              <h5>Corrective Maintenance Protocol (الصيانة التصحيحية)</h5>
              <p>{equipment_risk.corrective_action || 'Isolate equipment upon calibration failure, replace out-of-tolerance sensor elements, and recalibrate before clinical release.'}</p>
            </div>
          </div>
        </div>

        {/* Section 5: Recommendations */}
        {recommendations && recommendations.length > 0 && (
          <div className="report-section">
            <div className="report-section-header">
              <span>5. Specific Biomedical Recommendations</span>
              <span className="section-header-ar">توصيات الهندسة الطبية</span>
            </div>
            <ul className="recommendation-list">
              {recommendations.map((rec, idx) => (
                <li key={idx}><strong>{idx + 1}.</strong> {rec}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Signatures */}
        <div className="report-signatures">
          <div className="sig-box">
            <div className="sig-line"></div>
            <p className="sig-title">Prepared By (Biomedical Engineer)</p>
            <p className="sig-sub">مهندس الأجهزة الطبية</p>
          </div>
          <div className="sig-box">
            <div className="sig-line"></div>
            <p className="sig-title">Verified By (Clinical Engineering Manager)</p>
            <p className="sig-sub">مدير إدارة الهندسة الإكلينيكية</p>
          </div>
          <div className="sig-box">
            <div className="sig-line"></div>
            <p className="sig-title">Hospital Quality & Safety Office</p>
            <p className="sig-sub">مكتب الجودة وسلامة المرضى</p>
          </div>
        </div>

        {/* Footer */}
        <div className="report-footer">
          <p>Adam International Hospital — Medical Equipment Risk Assessment Document — ISO 13485 Compliant</p>
          <p>This report is electronically generated and digitally tracked for clinical quality and risk management.</p>
        </div>
      </div>
    </div>
  );
}
