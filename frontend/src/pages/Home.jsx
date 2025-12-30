import React, { useState, useEffect, useRef, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Search, Bot, FileText, CheckCircle, Loader2, Sparkles, Activity, Terminal, ExternalLink, ChevronRight, Cpu, BrainCircuit, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';

const WEBSOCKET_URL = "ws://localhost:8000/ws";

// Utility for merging classes
function cn(...inputs) {
    return twMerge(clsx(inputs));
}

// Memoized Log Item Component
const LogItem = memo(({ log }) => (
    <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex gap-3 text-slate-300 border-l-2 border-transparent hover:border-white/10 pl-2 transition-colors duration-200"
    >
        <span className="text-slate-600 shrink-0 select-none text-[10px] pt-1 font-mono">[{log.timestamp}]</span>
        <span className={cn(
            "break-words font-mono text-xs md:text-sm leading-relaxed",
            log.message.startsWith("---") && "text-indigo-400 font-bold border-b border-indigo-500/30 pb-1 w-full mt-2 mb-1",
            log.message.includes("Searching:") && "text-sky-300",
            log.type === 'error' && "text-red-400"
        )}>
            {log.message.startsWith("---") ? log.message.replace(/---/g, '') : log.message.replace('Searching:', '🔍 Searching:')}
        </span>
    </motion.div>
));

// Memoized Source Item Component
const SourceItem = memo(({ src }) => {
    let hostname = "unknown";
    try { hostname = new URL(src).hostname; } catch (e) { }
    return (
        <a href={src} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group border border-transparent hover:border-white/5">
            <img
                src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=32`}
                alt="icon"
                className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity"
                onError={(e) => { e.target.style.display = 'none' }}
            />
            <div className="flex flex-col overflow-hidden">
                <span className="text-xs font-medium text-slate-300 truncate group-hover:text-white transition-colors">{hostname}</span>
                <span className="text-[10px] text-slate-500 truncate font-mono opacity-60">{src}</span>
            </div>
        </a>
    );
});

export default function Home() {
    const [topic, setTopic] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [logs, setLogs] = useState([]);
    const [report, setReport] = useState(null);
    const [sources, setSources] = useState([]);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [user, setUser] = useState(null);

    const ws = useRef(null);
    const logsEndRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                navigate('/auth');
            } else {
                setUser(session.user);
            }
        };
        checkUser();
    }, [navigate]);

    // Auto-scroll logs
    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs.length]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/auth');
    };

    const startResearch = () => {
        if (!topic.trim()) return;

        setIsSearching(true);
        setLogs([]);
        setReport(null);
        setSources([]);
        setConnectionStatus('connecting');

        ws.current = new WebSocket(WEBSOCKET_URL);

        ws.current.onopen = () => {
            setConnectionStatus('connected');
            ws.current.send(JSON.stringify({ topic }));
            addLog('system', `Initialized agent for: ${topic}`);
        };

        ws.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleMessage(data);
            } catch (e) {
                console.error("Parse error", e);
            }
        };

        ws.current.onerror = (error) => {
            console.error("WS Error", error);
            setConnectionStatus('error');
            addLog('error', "Connection failed.");
            setIsSearching(false);
        };

        ws.current.onclose = () => {
            if (connectionStatus === 'connected') {
                addLog('system', "Disconnected.");
            }
        };
    };

    const handleMessage = (data) => {
        if (data.type === 'update') {
            if (data.logs && Array.isArray(data.logs)) {
                data.logs.forEach(msg => addLog('agent', msg, data.node));
            } else {
                addLog('agent', data.status, data.node);
            }

            if (data.sources && Array.isArray(data.sources)) {
                setSources(prev => {
                    const newSources = [...prev];
                    let changed = false;
                    data.sources.forEach(s => {
                        if (!newSources.includes(s) && s) {
                            newSources.push(s);
                            changed = true;
                        }
                    });
                    return changed ? newSources : prev;
                });
            }

        } else if (data.type === 'complete') {
            setReport(data.report);
            setIsSearching(false);
            ws.current.close();
        } else if (data.type === 'error') {
            addLog('error', data.message);
            setIsSearching(false);
        }
    };

    const addLog = (type, message, node = null) => {
        setLogs(prev => [...prev, { type, message, node, timestamp: new Date().toLocaleTimeString() }]);
    };

    if (!user) return null; // Or a loading spinner

    return (
        <div className="min-h-screen bg-[#050505] text-slate-200 font-sans selection:bg-indigo-500/30 overflow-x-hidden w-full relative">

            {/* Optimized Static Background */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#050505]">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-900/10 blur-[100px] animate-pulse-slow" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-purple-900/10 blur-[100px] animate-pulse-slow-delay" />
            </div>

            {/* Header */}
            <header className="fixed top-0 w-full z-50 backdrop-blur-md bg-[#050505]/80 border-b border-white/5">
                <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="p-1.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg shadow-indigo-500/25">
                            <Cpu className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-lg font-bold tracking-tight text-white leading-none font-display">
                                DeepResearch <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Pro</span>
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center space-x-4">
                        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                            <div className={`w-1.5 h-1.5 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                {connectionStatus === 'connected' ? 'System Online' : 'Standby'}
                            </span>
                        </div>

                        <button
                            onClick={handleLogout}
                            className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors"
                            title="Sign Out"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Container */}
            <main className="relative z-10 pt-24 pb-12 px-4 md:px-8 max-w-[1400px] mx-auto min-h-screen flex flex-col items-center">

                {/* Hero Section */}
                <AnimatePresence mode="wait">
                    {!isSearching && !report && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.2 } }}
                            transition={{ duration: 0.4 }}
                            className="w-full max-w-2xl text-center flex flex-col items-center justify-center min-h-[60vh]"
                        >
                            <div className="mb-6 p-1 rounded-full bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-white/5 backdrop-blur-sm inline-block">
                                <div className="px-4 py-1.5 rounded-full flex items-center gap-2">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                    <span className="text-xs font-medium text-slate-300">
                                        Powered by Gemini 2.5 & Tavily
                                    </span>
                                </div>
                            </div>

                            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-white mb-6 leading-[1.1]">
                                Research <span className="text-indigo-400">Autonomous.</span>
                            </h1>

                            <p className="text-lg text-slate-400 max-w-xl mx-auto mb-10 leading-relaxed font-light">
                                Enter a topic and watch the agent plan, research, and synthesize intelligence in real-time.
                            </p>

                            <div className="w-full relative group">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl opacity-20 blur transition duration-500"></div>
                                <div className="relative flex items-center bg-[#0a0a0a] rounded-xl shadow-2xl overflow-hidden ring-1 ring-white/10">
                                    <input
                                        type="text"
                                        value={topic}
                                        onChange={(e) => setTopic(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && startResearch()}
                                        placeholder="Enter research topic..."
                                        className="w-full bg-transparent text-white placeholder-slate-600 px-6 py-4 text-base focus:outline-none focus:ring-0"
                                        autoFocus
                                    />
                                    <button
                                        onClick={startResearch}
                                        disabled={!topic.trim()}
                                        className="mr-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                                    >
                                        <span>Start</span>
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Active State Layout */}
                <AnimatePresence>
                    {(isSearching || report) && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                            className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-120px)]"
                        >

                            {/* Left Column: Process Information */}
                            <div className="lg:col-span-4 flex flex-col gap-4 h-full overflow-hidden">

                                {/* Topic Card */}
                                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between shrink-0">
                                    <div className="flex flex-col overflow-hidden mr-4">
                                        <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Topic</span>
                                        <span className="text-white font-medium text-base truncate">{topic}</span>
                                    </div>
                                    {isSearching ? <Loader2 className="w-5 h-5 text-indigo-400 animate-spin shrink-0" /> : <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />}
                                </div>

                                {/* Terminal / Logs */}
                                <div className="flex-1 bg-[#0a0a0a]/80 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden flex flex-col shadow-xl">
                                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                                        <div className="flex items-center gap-2">
                                            <Terminal className="w-4 h-4 text-indigo-400" />
                                            <span className="text-xs font-mono text-slate-300 uppercase tracking-widest">System Log</span>
                                        </div>
                                        <div className="flex gap-1.5 opacity-50">
                                            <div className="w-2 h-2 rounded-full bg-red-500" />
                                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                                            <div className="w-2 h-2 rounded-full bg-green-500" />
                                        </div>
                                    </div>

                                    <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-1 custom-scrollbar scroll-smooth">
                                        {logs.map((log, idx) => (
                                            <LogItem key={idx} log={log} />
                                        ))}
                                        <div ref={logsEndRef} />
                                    </div>
                                </div>

                                {/* Sources Widget */}
                                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 max-h-[30%] min-h-[150px] overflow-hidden flex flex-col shrink-0 transition-all">
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <Activity className="w-3.5 h-3.5 text-pink-400" />
                                        Sources ({sources.length})
                                    </h3>
                                    <div className="w-full overflow-y-auto pr-1 space-y-2 custom-scrollbar flex-1">
                                        {sources.length === 0 ? (
                                            <div className="text-slate-600 italic text-xs py-4 text-center">Scanning knowledge base...</div>
                                        ) : (
                                            sources.map((src, i) => <SourceItem key={i} src={src} />)
                                        )}
                                    </div>
                                </div>

                            </div>

                            {/* Right Column: Report */}
                            <div className="lg:col-span-8 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl flex flex-col h-full overflow-hidden relative">
                                {/* Report Toolbar */}
                                <div className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-white/[0.02] shrink-0">
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-indigo-400" />
                                        <span className="font-semibold text-slate-200 text-sm tracking-wide">Report View</span>
                                    </div>
                                    {report && (
                                        <button
                                            onClick={() => navigator.clipboard.writeText(report)}
                                            className="text-[10px] text-slate-400 hover:text-white px-3 py-1.5 rounded-full border border-white/10 hover:bg-white/5 transition-all uppercase tracking-wider font-medium"
                                        >
                                            Copy Markdown
                                        </button>
                                    )}
                                </div>

                                {/* Report Content */}
                                <div className="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar relative bg-[#0a0a0a]">
                                    {report ? (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ duration: 0.5 }}
                                            className="prose prose-invert prose-lg max-w-none 
                            prose-headings:font-display prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-slate-100
                            prose-h1:text-4xl prose-h1:mb-8 prose-h1:pb-4 prose-h1:border-b prose-h1:border-white/10 prose-h1:text-transparent prose-h1:bg-clip-text prose-h1:bg-gradient-to-r prose-h1:from-indigo-300 prose-h1:to-white
                            prose-h2:text-2xl prose-h2:text-indigo-200 prose-h2:mt-10 prose-h2:mb-4 prose-h2:flex prose-h2:items-center prose-h2:gap-3
                            prose-h3:text-lg prose-h3:text-slate-200 prose-h3:mt-6 prose-h3:mb-2
                            prose-p:text-slate-300 prose-p:leading-7 prose-p:mb-4 prose-p:text-base
                            prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline
                            prose-strong:text-white prose-strong:font-semibold
                            prose-ul:my-4 prose-li:my-1 prose-li:text-slate-300 prose-li:marker:text-indigo-500
                            prose-ol:my-4 prose-li:text-slate-300 prose-ol:marker:text-indigo-500
                            prose-blockquote:border-l-4 prose-blockquote:border-indigo-500 prose-blockquote:bg-white/[0.02] prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:my-6
                            prose-hr:border-white/10 prose-hr:my-8
                           "
                                        >
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    h2: ({ node, ...props }) => <h2 {...props} className="text-2xl font-bold text-slate-100 mt-10 mb-4 flex items-center gap-2 border-l-4 border-indigo-500 pl-4 bg-gradient-to-r from-indigo-500/10 to-transparent py-1 rounded-r-lg" />,
                                                    h3: ({ node, ...props }) => <h3 {...props} className="text-xl font-semibold text-slate-200 mt-8 mb-3 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-purple-400 display-inline-block"></span>{props.children}</h3>
                                                }}
                                            >
                                                {report}
                                            </ReactMarkdown>

                                            {/* Footer Signature */}
                                            <div className="mt-16 pt-8 border-t border-white/5 flex flex-col items-center justify-center text-center opacity-40">
                                                <BrainCircuit className="w-6 h-6 text-indigo-500 mb-2" />
                                                <p className="text-xs text-slate-500">Autonomous Intelligence Report</p>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-center p-12">
                                            <div className="relative w-20 h-20 mb-6">
                                                <div className="absolute inset-0 border-t-2 border-indigo-500 rounded-full animate-spin"></div>
                                                <div className="absolute inset-2 border-r-2 border-purple-500 rounded-full animate-spin-reverse"></div>
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <Bot className="w-8 h-8 text-white/20" />
                                                </div>
                                            </div>
                                            <h3 className="text-xl font-medium text-white mb-2">Processing Data</h3>
                                            <p className="text-slate-500 max-w-xs mx-auto text-sm">
                                                Traversing knowledge nodes...
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                        </motion.div>
                    )}
                </AnimatePresence>

            </main>

            <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #050505;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #262626;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #404040;
        }
        .animate-pulse-slow {
            animation: pulse 8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .animate-pulse-slow-delay {
            animation: pulse 8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            animation-delay: 4s;
        }
        @keyframes spin-reverse {
            from { transform: rotate(360deg); }
            to { transform: rotate(0deg); }
        }
        .animate-spin-reverse {
            animation: spin-reverse 1.5s linear infinite;
        }
      `}</style>
        </div>
    );
}
