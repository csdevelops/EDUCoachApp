import React, { useState, useRef, useEffect } from 'react';
import { generateCoachingStarters } from '../services/geminiService';
import { Loader2, FileText, Share2, Download, Copy, Mail, MessageSquare, Send, X, Printer, FileType, FileJson, User, GraduationCap, Briefcase, MessageCircle } from 'lucide-react';

interface TemplateGeneratorProps {
    onActivityLog?: (description: string) => void;
}

const SENTENCE_STARTERS = [
    "What is the most important thing for us to focus on today?",
    "I noticed that... and I wonder...",
    "What would a successful outcome look like?",
    "What is the real challenge here for you?",
    "Tell me more about what happened when...",
    "If you could change one thing about this, what would it be?",
    "What specific support do you need to move forward?",
    "How does this align with your wider goals?",
    "What are some other options you haven't considered yet?",
    "What is one small step you can take tomorrow?"
];

const TemplateGenerator: React.FC<TemplateGeneratorProps> = ({ onActivityLog }) => {
  // Inputs
  const [studentName, setStudentName] = useState('');
  const [coachName, setCoachName] = useState('');
  const [gradeLevel, setGradeLevel] = useState('Middle School (6th-8th)');
  const [sentenceStarter, setSentenceStarter] = useState(SENTENCE_STARTERS[0]);
  
  // Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [content, setContent] = useState<string>(''); // Editable Content
  const [hasGenerated, setHasGenerated] = useState(false);

  // UI State
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const [smsNumber, setSmsNumber] = useState('');
  const [isSmsMode, setIsSmsMode] = useState(false);

  const handleGenerate = async () => {
    if (!studentName || !coachName) return;
    
    setIsGenerating(true);
    const text = await generateCoachingStarters(studentName, coachName, gradeLevel, sentenceStarter);
    setContent(text);
    setHasGenerated(true);
    setIsGenerating(false);

    if (text && !text.startsWith("Error") && onActivityLog) {
        onActivityLog(`Generated coaching session for ${studentName}`);
    }
  };

  const copyToClipboard = () => {
    if (content) {
      navigator.clipboard.writeText(content);
      alert("Copied to clipboard!");
    }
  };

  const handleDownload = (format: 'txt' | 'md' | 'doc' | 'pdf') => {
    if (!content) return;
    
    let textToSave = content;
    let mimeType = 'text/plain';
    let extension = 'txt';

    if (format === 'pdf') {
         const printWindow = window.open('', '', 'height=600,width=800');
         if (printWindow) {
             printWindow.document.write('<html><head><title>Coaching Session</title>');
             printWindow.document.write('<style>body { font-family: "Times New Roman", serif; padding: 2rem; line-height: 1.6; white-space: pre-wrap; color: #000; } h1, h2, h3 { color: #333; }</style>');
             printWindow.document.write('</head><body>');
             printWindow.document.write(content);
             printWindow.document.write('</body></html>');
             printWindow.document.close();
             printWindow.focus();
             setTimeout(() => {
                 printWindow.print();
             }, 500);
         }
         setIsDownloadMenuOpen(false);
         if (onActivityLog) onActivityLog(`Downloaded session as PDF`);
         return;
    }

    if (format === 'doc') {
        mimeType = 'application/msword';
        extension = 'doc';
        // Simple HTML wrap for Word
        textToSave = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head><meta charset='utf-8'></head>
            <body>
                <pre style="font-family: 'Times New Roman', serif; font-size: 12pt; white-space: pre-wrap;">${content}</pre>
            </body>
            </html>
        `;
    } else if (format === 'md') {
        extension = 'md';
    }

    const element = document.createElement("a");
    const file = new Blob([textToSave], {type: mimeType});
    element.href = URL.createObjectURL(file);
    element.download = `Coaching_Session_${studentName.replace(/\s+/g, '_')}_${Date.now()}.${extension}`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setIsDownloadMenuOpen(false);
    if (onActivityLog) onActivityLog(`Downloaded session as ${extension.toUpperCase()}`);
  };

  const shareViaEmail = () => {
      const subject = `Coaching Session Summary: ${studentName}`;
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(content)}`;
  }

  const shareViaWhatsapp = () => {
      window.open(`https://wa.me/?text=${encodeURIComponent(content)}`, '_blank');
  }

  const handleSendSms = () => {
    if (!content) return;
    const body = encodeURIComponent(content);
    window.location.href = `sms:${smsNumber}?&body=${body}`;
    setIsSmsMode(false);
    if (onActivityLog) onActivityLog(`Shared session via SMS to ${smsNumber}`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto h-full flex flex-col">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
        
        {/* Input Section - Sidebar Style on Large Screens */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-6 border border-slate-100 dark:border-slate-700 transition-colors h-fit">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            <Briefcase className="text-indigo-600 dark:text-indigo-400" /> Coaching Details
          </h2>
          
          <div className="space-y-5">
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Coach Name</label>
                <div className="relative">
                    <User className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <input 
                        type="text"
                        value={coachName}
                        onChange={(e) => setCoachName(e.target.value)}
                        placeholder="e.g. Mr. Anderson"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-slate-50 text-slate-900 focus:bg-slate-800 focus:text-white dark:bg-slate-800 dark:text-white"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Student Name</label>
                <div className="relative">
                    <User className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <input 
                        type="text"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="e.g. Jordan Smith"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-slate-50 text-slate-900 focus:bg-slate-800 focus:text-white dark:bg-slate-800 dark:text-white"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Grade Level</label>
                <div className="relative">
                    <GraduationCap className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <select 
                        value={gradeLevel}
                        onChange={(e) => setGradeLevel(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-slate-50 text-slate-900 focus:bg-slate-800 focus:text-white dark:bg-slate-800 dark:text-white appearance-none"
                    >
                        <option>6th Grade</option>
                        <option>7th Grade</option>
                        <option>8th Grade</option>
                        <option>9th Grade (Freshman)</option>
                        <option>10th Grade (Sophomore)</option>
                        <option>11th Grade (Junior)</option>
                        <option>12th Grade (Senior)</option>
                        <option>College / University</option>
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Sentence Starter</label>
                <div className="relative">
                    <MessageCircle className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <select 
                        value={sentenceStarter}
                        onChange={(e) => setSentenceStarter(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-slate-50 text-slate-900 focus:bg-slate-800 focus:text-white dark:bg-slate-800 dark:text-white appearance-none"
                    >
                        {SENTENCE_STARTERS.map((t, i) => (
                            <option key={i} value={t}>{t}</option>
                        ))}
                    </select>
                </div>
            </div>

            <button 
                onClick={handleGenerate}
                disabled={isGenerating || !studentName || !coachName}
                className={`w-full py-3.5 rounded-xl text-white font-bold text-lg flex items-center justify-center gap-2 transition-all mt-4
                    ${isGenerating || !studentName || !coachName
                        ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed' 
                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-indigo-200 dark:shadow-indigo-900/20 transform hover:-translate-y-0.5'}`}
            >
                {isGenerating ? (
                    <>
                        <Loader2 className="animate-spin h-5 w-5" /> Creating...
                    </>
                ) : (
                    "Create Session Draft"
                )}
            </button>
          </div>
        </div>

        {/* Output Section */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-6 border border-slate-100 dark:border-slate-700 flex flex-col h-full min-h-[600px] transition-colors">
          <div className="flex flex-wrap gap-4 justify-between items-center mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <FileText className="text-indigo-500" /> Session Document
            </h2>
            
            {content && (
                <div className="flex gap-2">
                    <button onClick={copyToClipboard} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300 transition-colors" title="Copy Text">
                        <Copy className="h-5 w-5" />
                    </button>
                    
                    {/* Dropdown for Download */}
                    <div className="relative">
                        <button 
                            onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)} 
                            className={`p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors ${isDownloadMenuOpen ? 'bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-300'}`}
                            title="Download Options"
                        >
                            <Download className="h-5 w-5" />
                        </button>

                        {isDownloadMenuOpen && (
                            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-600 overflow-hidden z-20 animate-in fade-in slide-in-from-top-2">
                                <div className="p-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    Download Format
                                </div>
                                <button onClick={() => handleDownload('pdf')} className="w-full text-left px-4 py-3 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 transition-colors">
                                    <Printer className="h-4 w-4 text-slate-400" /> Save as PDF
                                </button>
                                <button onClick={() => handleDownload('doc')} className="w-full text-left px-4 py-3 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 transition-colors">
                                    <FileType className="h-4 w-4 text-blue-500" /> Word Doc
                                </button>
                                <button onClick={() => handleDownload('md')} className="w-full text-left px-4 py-3 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 transition-colors">
                                    <FileText className="h-4 w-4 text-slate-400" /> Markdown
                                </button>
                                <button onClick={() => handleDownload('txt')} className="w-full text-left px-4 py-3 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 transition-colors">
                                    <FileJson className="h-4 w-4 text-slate-400" /> Text File
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
          </div>

          <div className="flex-1 relative bg-slate-50 dark:bg-slate-950 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all">
            {!hasGenerated && !content ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 p-8 text-center">
                    <FileText className="h-16 w-16 mb-4 opacity-20" />
                    <p className="text-lg font-medium mb-2">Ready to draft your session</p>
                    <p className="text-sm max-w-xs">Enter the details on the left and click "Create Session Draft" to generate fill-in-the-blank starters.</p>
                </div>
            ) : (
                <textarea 
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full h-full p-6 bg-transparent outline-none font-mono text-sm text-slate-800 dark:text-slate-200 resize-none leading-relaxed"
                    spellCheck={false}
                    placeholder="Session document..."
                />
            )}
          </div>

          {content && (
             isSmsMode ? (
                <div className="mt-6 flex gap-2 animate-in fade-in slide-in-from-bottom-2">
                    <input 
                        type="tel" 
                        value={smsNumber}
                        onChange={(e) => setSmsNumber(e.target.value)}
                        placeholder="Enter mobile number..."
                        className="flex-1 p-3 rounded-lg border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-slate-50 text-slate-900 focus:bg-slate-800 focus:text-white dark:bg-slate-800 dark:text-white"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleSendSms()}
                    />
                    <button 
                        onClick={handleSendSms}
                        className="flex items-center justify-center gap-2 px-6 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium transition-colors shadow-sm"
                    >
                        <Send className="h-4 w-4" /> Send
                    </button>
                    <button 
                        onClick={() => setIsSmsMode(false)}
                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
             ) : (
              <div className="mt-6 grid grid-cols-3 gap-4">
                  <button onClick={shareViaEmail} className="flex items-center justify-center gap-2 py-3 rounded-lg bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/40 font-medium transition-colors">
                      <Mail className="h-4 w-4" /> Email
                  </button>
                  <button onClick={shareViaWhatsapp} className="flex items-center justify-center gap-2 py-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 font-medium transition-colors">
                      <MessageSquare className="h-4 w-4" /> WhatsApp
                  </button>
                  <button onClick={() => setIsSmsMode(true)} className="flex items-center justify-center gap-2 py-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 font-medium transition-colors">
                      <Share2 className="h-4 w-4" /> Text
                  </button>
              </div>
             )
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplateGenerator;