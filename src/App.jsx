import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Code,
  Folder,
  FileText,
  Settings,
  Shield,
  LogOut,
  Flame,
  Zap,
  Check,
  X,
  Search,
  AlertTriangle,
  Save,
  Loader2,
  Lock,
  MessageSquare,
  TrendingUp,
  User,
  HelpCircle,
  Play
} from 'lucide-react';

// Timezone-aware local date helper
function getLocalDateString() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
}

// Markdown parser helper for mock schemas and AI responses
function parseMarkdown(text) {
  if (!text) return '';
  let html = text;

  // Escape basic HTML tags to prevent issues
  html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Code blocks
  html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
    return `<pre class="bg-slate-900 text-slate-100 p-4 rounded-xl font-code text-xs overflow-x-auto my-3 text-left"><code>${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="font-code bg-slate-100 px-1.5 py-0.5 rounded text-xs text-brand-600 font-semibold">$1</code>');

  // Bold text
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h4 class="text-sm font-bold mt-4 mb-1.5 text-slate-800">$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3 class="text-base font-extrabold mt-5 mb-2 text-slate-800 border-b border-slate-200 pb-1">$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2 class="text-lg font-black mt-6 mb-3 text-slate-900">$1</h2>');

  // Unordered Lists
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li class="ml-4 list-disc text-xs text-slate-600 my-0.5">$1</li>');

  // Ordered Lists
  html = html.replace(/^\s*\d+\.\s+(.*$)/gim, '<li class="ml-4 list-decimal text-xs text-slate-600 my-0.5">$1</li>');

  // Simple Table parser
  const lines = html.split('\n');
  let inTable = false;
  let tableHTML = '';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (line.startsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableHTML = '<table class="w-full border-collapse border border-slate-200 text-xs my-3">';
      }

      let cells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
      if (line.includes('---')) continue;

      tableHTML += '<tr class="border-b border-slate-200">';
      cells.forEach(cell => {
        if (tableHTML.indexOf('</th>') === -1) {
          tableHTML += `<th class="bg-slate-50 p-2.5 font-bold text-left border-r border-slate-200 text-slate-700">${cell}</th>`;
        } else {
          tableHTML += `<td class="p-2.5 border-r border-slate-200 text-slate-600 bg-white">${cell}</td>`;
        }
      });
      tableHTML += '</tr>';
    } else {
      if (inTable) {
        inTable = false;
        tableHTML += '</table>';
        lines[i - 1] = tableHTML;
      }
    }
  }
  html = lines.join('\n');

  // Paragraph breaks
  html = html.replace(/\n\n/g, '<p class="my-2 text-xs text-slate-600"></p>');

  return html;
}

export default function App() {
  // App Config and Core State
  const [currentUser, setCurrentUser] = useState(null);
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeQBankTab, setActiveQBankTab] = useState('sql');
  const [qbankFilters, setQbankFilters] = useState({ search: '', difficulty: '', status: '' });
  const [notifications, setNotifications] = useState([]);
  
  // Modal toggles
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [selectedQuestionCategory, setSelectedQuestionCategory] = useState('sql');
  const [workspaceTab, setWorkspaceTab] = useState('code');
  const [workspaceCode, setWorkspaceCode] = useState('');
  const [workspaceNotes, setWorkspaceNotes] = useState('');
  const [aiSubTab, setAiSubTab] = useState('schema');
  const [aiChatQuery, setAiChatQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  // Authentication overlays state
  const [authMode, setAuthMode] = useState('login');
  const [loginForm, setLoginForm] = useState({ email: '', pin: '' });
  const [signupForm, setSignupForm] = useState({ name: '', email: '', goal: '', pin: '' });

  // Admin Dashboard State
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminSearch, setAdminSearch] = useState('');
  const [adminSelectedUser, setAdminSelectedUser] = useState(null);
  const [adminSelectedUserProgress, setAdminSelectedUserProgress] = useState(null);
  const [adminInspectTab, setAdminInspectTab] = useState('overview');
  const [adminInspectDay, setAdminInspectDay] = useState(null);
  const [adminInspectCategory, setAdminInspectCategory] = useState('sql');
  const [adminInspectQId, setAdminInspectQId] = useState(null);

  // Determine backend URL
  const hostname = window.location.hostname;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '';
  let API_BASE_URL = localStorage.getItem('de_tracker_backend_url') || '';
  if (!API_BASE_URL) {
    API_BASE_URL = isLocal ? 'http://localhost:8000' : '';
  }
  if (API_BASE_URL.endsWith('/')) {
    API_BASE_URL = API_BASE_URL.slice(0, -1);
  }

  // Toast Notification handler
  const showNotification = (message, type = 'success') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4500);
  };

  // 1. Initial Load: Fetch Curriculum and Check Session
  useEffect(() => {
    async function init() {
      try {
        const resCurriculum = await fetch(API_BASE_URL + '/de_master_roadmap_database.json');
        if (!resCurriculum.ok) throw new Error("Could not load curriculum data.");
        const baselineData = await resCurriculum.json();

        const sessionUser = localStorage.getItem('de_tracker_user');
        if (sessionUser) {
          const parsedUser = JSON.parse(sessionUser);
          setCurrentUser(parsedUser);

          const resProgress = await fetch(API_BASE_URL + `/api/user/${parsedUser.id}/data`);
          if (!resProgress.ok) {
            logout();
            return;
          }
          const progressPayload = await resProgress.json();
          mergeUserProgress(baselineData, progressPayload);
        } else {
          setDb(baselineData);
        }
      } catch (err) {
        console.error(err);
        showNotification("Could not initialize database. Verify connection or refresh.", "error");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const logout = () => {
    localStorage.removeItem('de_tracker_user');
    setCurrentUser(null);
    window.location.reload();
  };

  // Helper to merge database progress row arrays into structural baseline state
  const mergeUserProgress = (baseline, data) => {
    const merged = { ...baseline };

    // Merge User Profile
    const profile = data.profile || null;
    merged.user_profile = {
      name: profile?.name || currentUser?.name || 'Student',
      email: profile?.email || currentUser?.email || '',
      goal: profile?.goal || currentUser?.goal || '',
      target_companies: profile?.target_companies || [],
      daily_study_hours: profile?.daily_study_hours || 5,
      balance: profile?.balance || 0,
      current_streak: profile?.current_streak || 0,
      best_streak: profile?.best_streak || 0,
      xp: profile?.xp || 0,
      level: profile?.level || 1,
      ai_coach_calls: profile?.ai_coach_calls || 0,
      gemini_api_key: profile?.gemini_api_key || '',
      simulated_date: profile?.simulated_date || getLocalDateString(),
      last_checkin_date: profile?.last_checkin_date,
      last_quest_date: profile?.last_quest_date,
      claimed_checkin_dates: profile?.claimed_checkin_dates || [],
      daily_quests: profile?.daily_quests || []
    };

    // Merge Calendar Days
    const calendarRows = data.calendar || [];
    calendarRows.forEach(row => {
      const targetDay = merged.calendar.find(d => d.day_number === row.day_number);
      if (targetDay) {
        targetDay.completed = row.completed;
        targetDay.morning_completed = row.morning_completed;
        targetDay.afternoon_completed = row.afternoon_completed;
        targetDay.evening_completed = row.evening_completed;
        targetDay.penalized = row.penalized;
        targetDay.notes = row.notes || '';
        targetDay.time_spent_minutes = row.time_spent_minutes || 0;
        targetDay.rating = row.rating;
      }
    });

    // Merge Questions
    const questionRows = data.questions || [];
    questionRows.forEach(row => {
      let qList = [];
      if (row.category === 'sql') qList = merged.sql_question_bank;
      else if (row.category === 'dsa') qList = merged.dsa_problems;
      else if (row.category === 'pyspark') qList = merged.pyspark_questions;
      else if (row.category === 'concepts') qList = merged.de_concepts;
      else if (row.category === 'interview') qList = merged.interview_prep;

      const targetQ = qList.find(q => q.id === row.item_id);
      if (targetQ) {
        targetQ.solved = row.solved;
        targetQ.notes = row.notes || '';
        targetQ.solution_code = row.solution_code || '';
        targetQ.confidence_level = row.confidence_level || 0;
        targetQ.attempts = row.attempts || 0;
        targetQ.ai_schema_context = row.ai_schema_context || null;
        targetQ.ai_code_review_hint = row.ai_code_review_hint || null;
        targetQ.ai_chat_history = row.ai_chat_history || [];
      }
    });

    // Merge Projects
    const projectRows = data.projects || [];
    projectRows.forEach(row => {
      const targetProj = merged.projects.find(p => p.name === row.project_name);
      if (targetProj) {
        targetProj.completed = row.completed;
        targetProj.github_url = row.github_url || '';
        targetProj.notes = row.notes || '';
        targetProj.rating = row.rating;
        targetProj.time_spent_hours = row.time_spent_hours || 0;
      }
    });

    // Merge Milestones
    const milestoneRows = data.milestones || [];
    milestoneRows.forEach(row => {
      const targetMs = merged.milestones.find(m => m.name === row.milestone_name);
      if (targetMs) {
        targetMs.completed = row.completed;
      }
    });

    // Merge Cheatsheets
    const cheatsheetRows = data.cheat_sheets || [];
    cheatsheetRows.forEach(row => {
      if (merged.cheat_sheets[row.sheet_key]) {
        merged.cheat_sheets[row.sheet_key].content = row.content || '';
      }
    });

    setDb(merged);
  };

  // Synchronizers communicating client updates to PostgreSQL
  const syncProfile = async (updatedProfile) => {
    if (!currentUser) return;
    try {
      await fetch(API_BASE_URL + `/api/user/${currentUser.id}/update-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProfile)
      });
    } catch (err) {
      console.error("Profile sync error:", err);
    }
  };

  const syncCalendarDay = async (day) => {
    if (!currentUser) return;
    try {
      await fetch(API_BASE_URL + `/api/user/${currentUser.id}/update-calendar-day`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_number: day.day_number,
          morning_completed: day.morning_completed,
          afternoon_completed: day.afternoon_completed,
          evening_completed: day.evening_completed,
          completed: day.completed,
          penalized: day.penalized,
          notes: day.notes,
          time_spent_minutes: day.time_spent_minutes,
          rating: day.rating
        })
      });
    } catch (err) {
      console.error("Calendar day sync error:", err);
    }
  };

  const syncQuestion = async (category, question) => {
    if (!currentUser) return;
    try {
      await fetch(API_BASE_URL + `/api/user/${currentUser.id}/update-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          item_id: question.id,
          solved: question.solved || false,
          notes: question.notes || '',
          solution_code: question.solution_code || '',
          confidence_level: question.confidence_level || 0,
          attempts: question.attempts || 0,
          ai_schema_context: question.ai_schema_context || null,
          ai_code_review_hint: question.ai_code_review_hint || null,
          ai_chat_history: question.ai_chat_history || []
        })
      });
    } catch (err) {
      console.error("Question sync error:", err);
    }
  };

  const syncProject = async (proj) => {
    if (!currentUser) return;
    try {
      await fetch(API_BASE_URL + `/api/user/${currentUser.id}/update-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_name: proj.name,
          project_week: proj.week,
          completed: proj.completed,
          github_url: proj.github_url || '',
          notes: proj.notes || '',
          rating: proj.rating || null,
          time_spent_hours: proj.time_spent_hours || 0
        })
      });
    } catch (err) {
      console.error("Project sync error:", err);
    }
  };

  const syncCheatSheet = async (key, sheet) => {
    if (!currentUser) return;
    try {
      await fetch(API_BASE_URL + `/api/user/${currentUser.id}/update-cheatsheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet_key: key,
          content: sheet.content || ''
        })
      });
    } catch (err) {
      console.error("Cheat sheet sync error:", err);
    }
  };

  // Reset progress logic
  const handleResetDatabase = async () => {
    if (!window.confirm("Are you absolutely sure you want to delete all notes, codes, and tracker progress from the database? This action is irreversible.")) {
      return;
    }
    try {
      const res = await fetch(API_BASE_URL + `/api/user/${currentUser.id}/reset`, {
        method: 'POST'
      });
      if (res.ok) {
        showNotification("All tracker data has been reset to baseline!", "success");
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        showNotification("Failed to reset database progress.", "error");
      }
    } catch (err) {
      showNotification("Error communicating reset trigger to server.", "error");
    }
  };

  // User Authentication Submit Triggers
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    try {
      if (authMode === 'login') {
        if (!loginForm.email || !loginForm.pin) {
          alert("Please fill in email and login PIN!");
          return;
        }
        const res = await fetch(API_BASE_URL + '/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(loginForm)
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "Login credentials failed!");
          return;
        }
        localStorage.setItem('de_tracker_user', JSON.stringify(data.user));
        window.location.reload();
      } else {
        if (!signupForm.name || !signupForm.email || !signupForm.pin) {
          alert("Name, Email, and PIN are required for Signup!");
          return;
        }
        const res = await fetch(API_BASE_URL + '/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(signupForm)
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "Signup error!");
          return;
        }
        localStorage.setItem('de_tracker_user', JSON.stringify(data.user));
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
      alert("API request authentication failure.");
    }
  };

  // Admin Authentication & Listing Triggers
  const handleAdminVerify = async (e) => {
    e.preventDefault();
    if (adminPinInput === '6565') {
      setAdminAuthenticated(true);
      showNotification("Access granted to administrator cockpit.", "success");
      loadAdminDirectory();
    } else {
      alert("❌ Invalid security PIN.");
    }
  };

  const loadAdminDirectory = async () => {
    try {
      const res = await fetch(API_BASE_URL + '/api/admin/users');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAdminUsers(data.users || []);
    } catch (err) {
      showNotification("Failed to fetch admin users directory.", "error");
    }
  };

  const deleteUserAccount = async (userId, name) => {
    if (!window.confirm(`⚠️ WARNING: Are you sure you want to completely delete "${name}"? All progress is destroyed.`)) {
      return;
    }
    try {
      const res = await fetch(API_BASE_URL + `/api/admin/user/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        showNotification("User wiped successfully.", "success");
        if (adminSelectedUser && adminSelectedUser.id === userId) {
          setAdminSelectedUser(null);
          setAdminSelectedUserProgress(null);
        }
        loadAdminDirectory();
      } else {
        alert("Failed to delete user.");
      }
    } catch (err) {
      alert("Delete transaction failed.");
    }
  };

  const selectUserAdminInspect = async (user) => {
    setAdminSelectedUser(user);
    setAdminSelectedUserProgress(null);
    try {
      const res = await fetch(API_BASE_URL + `/api/user/${user.id}/data`);
      if (res.ok) {
        const progress = await res.json();
        const resBaseline = await fetch(API_BASE_URL + '/de_master_roadmap_database.json');
        const baseline = await resBaseline.json();
        mergeUserProgress(baseline, progress);
        setAdminSelectedUserProgress(baseline);
      }
    } catch (err) {
      alert("Failed loading user inspection payload.");
    }
  };

  // Upgraded Gemini AI Coach Integration
  const callGemini = async (systemInstruction, promptText) => {
    const apiKey = db.user_profile.gemini_api_key;
    if (!apiKey) {
      throw new Error("No Gemini API key defined in Settings! Please add your key first.");
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;
    const payload = {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: promptText }] }]
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || "Gemini endpoint error.");
    }
    const data = await res.json();
    return data.candidates[0].content.parts[0].text;
  };

  const generateSchemaMockTables = async () => {
    setAiLoading(true);
    setAiError('');
    const sys = "You are the Data Engineering Coach. You help the user understand queries and algorithms. You must NEVER give the direct solution code. You explain concepts, generate rich markdown tables, database schemas, and edge case parameters.";
    const prompt = `
      Category: ${selectedQuestionCategory.toUpperCase()}
      Question: ${selectedQuestion.question || selectedQuestion.title}
      Topic: ${selectedQuestion.topic || selectedQuestion.pattern || "General"}

      Task:
      If it is a SQL question, generate a realistic database table schema (represented as clean markdown tables) and 3-5 rows of sample records, explaining what each column represents.
      If it is a DSA question, generate 3 sample test cases showing input and expected outputs, highlighting edge cases.
      If it is a PySpark or Core Concept question, explain the underlying architecture, mechanics, and trade-offs.

      Remember: DO NOT write any SQL or Python solution code. Focus purely on schemas and test cases.
    `;

    try {
      const result = await callGemini(sys, prompt);
      const updatedQ = { ...selectedQuestion, ai_schema_context: result };
      setSelectedQuestion(updatedQ);

      let list = getQuestionList(selectedQuestionCategory);
      const idx = list.findIndex(q => q.id === selectedQuestion.id);
      if (idx !== -1) list[idx] = updatedQ;

      const updatedProfile = {
        ...db.user_profile,
        xp: db.user_profile.xp + 10,
        ai_coach_calls: (db.user_profile.ai_coach_calls || 0) + 1
      };
      updatedProfile.level = Math.floor(Math.sqrt(updatedProfile.xp / 100)) + 1;

      setDb(prev => ({
        ...prev,
        user_profile: updatedProfile
      }));

      syncProfile(updatedProfile);
      syncQuestion(selectedQuestionCategory, updatedQ);
      showNotification("📊 Schema context generated! +10 XP");
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const evaluateAndRateSolution = async () => {
    if (!workspaceCode.trim()) {
      alert("Please write some code inside the editor before asking the coach to evaluate!");
      return;
    }
    setAiLoading(true);
    setAiError('');

    const sys = "You are the Data Engineering Coach. You evaluate the user's code and rate it on a scale of 1 to 10. You identify logic bugs, edge case failures, performance issues, or syntax flaws. You must NEVER give the direct solution code. You must respond in a friendly tone giving a clear Score /10, a breakdown critique, and incremental hints.";
    const prompt = `
      Question: ${selectedQuestion.question || selectedQuestion.title}
      Category: ${selectedQuestionCategory.toUpperCase()}
      
      Generated Reference Schema Context:
      ${selectedQuestion.ai_schema_context || "No mock tables generated yet."}
      
      Student's Code Solution:
      \`\`\`
      ${workspaceCode}
      \`\`\`

      Task:
      1. Rate the solution on a scale of 1 to 10 (where 10 is fully correct, optimal, and matches the schema constraints).
      2. Provide a constructive review, explaining what works and where the logical errors lie.
      3. Give 2-3 incremental hints so the student can fix the flaws.
      
      Remember: DO NOT write any corrected SQL queries or python code. Focus on guiding.
    `;

    try {
      const result = await callGemini(sys, prompt);
      const updatedQ = { ...selectedQuestion, ai_code_review_hint: result };
      setSelectedQuestion(updatedQ);

      let list = getQuestionList(selectedQuestionCategory);
      const idx = list.findIndex(q => q.id === selectedQuestion.id);
      if (idx !== -1) list[idx] = updatedQ;

      const updatedProfile = {
        ...db.user_profile,
        xp: db.user_profile.xp + 15,
        ai_coach_calls: (db.user_profile.ai_coach_calls || 0) + 1
      };
      updatedProfile.level = Math.floor(Math.sqrt(updatedProfile.xp / 100)) + 1;

      setDb(prev => ({
        ...prev,
        user_profile: updatedProfile
      }));

      syncProfile(updatedProfile);
      syncQuestion(selectedQuestionCategory, updatedQ);
      showNotification("💡 Solution graded by Coach! +15 XP");
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const sendAICustomDoubt = async (e) => {
    e.preventDefault();
    if (!aiChatQuery.trim()) return;
    setAiLoading(true);
    setAiError('');

    const sys = "You are the Data Engineering Coach. You help the user debug. You must NEVER give the direct solution code. Guide them through hints, questions, or edge cases.";
    const userMessage = { role: "user", text: aiChatQuery };
    const currentHistory = [...(selectedQuestion.ai_chat_history || []), userMessage];

    let promptContext = `Question: ${selectedQuestion.question || selectedQuestion.title}\n\n`;
    currentHistory.forEach(msg => {
      promptContext += `${msg.role === 'coach' ? 'Coach' : 'User'}: ${msg.text}\n`;
    });
    promptContext += "\nCoach response (NEVER write SQL or Python code solutions):";

    try {
      const result = await callGemini(sys, promptContext);
      const coachMessage = { role: "coach", text: result };
      const updatedHistory = [...currentHistory, coachMessage];
      const updatedQ = { ...selectedQuestion, ai_chat_history: updatedHistory };
      setSelectedQuestion(updatedQ);

      let list = getQuestionList(selectedQuestionCategory);
      const idx = list.findIndex(q => q.id === selectedQuestion.id);
      if (idx !== -1) list[idx] = updatedQ;

      syncQuestion(selectedQuestionCategory, updatedQ);
      setAiChatQuery('');
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  // Helper selectors
  const getQuestionList = (cat) => {
    if (!db) return [];
    if (cat === 'sql') return db.sql_question_bank;
    if (cat === 'dsa') return db.dsa_problems;
    if (cat === 'pyspark') return db.pyspark_questions;
    if (cat === 'concepts') return db.de_concepts;
    if (cat === 'interview') return db.interview_prep;
    return [];
  };

  // Checkbox Checkin System (Calendar Day Completion)
  const toggleCalendarTask = (dayNumber, taskKey) => {
    const updatedCalendar = [...db.calendar];
    const day = updatedCalendar.find(d => d.day_number === dayNumber);
    if (!day) return;

    day[taskKey] = !day[taskKey];

    const allChecked = day.morning_completed && day.afternoon_completed && day.evening_completed;
    const wasCompleted = day.completed;
    day.completed = allChecked;

    let xpGained = 0;
    if (day[taskKey]) {
      if (taskKey === 'morning_completed') xpGained += 15;
      else if (taskKey === 'afternoon_completed') xpGained += 15;
      else if (taskKey === 'evening_completed') xpGained += 20;
    } else {
      if (taskKey === 'morning_completed') xpGained -= 15;
      else if (taskKey === 'afternoon_completed') xpGained -= 15;
      else if (taskKey === 'evening_completed') xpGained -= 20;
    }

    if (allChecked && !wasCompleted) {
      xpGained += 50;
      showNotification("☀️ Day fully completed! +50 XP bonus!");
    } else if (!allChecked && wasCompleted) {
      xpGained -= 50;
    }

    let currentStreak = db.user_profile.current_streak || 0;
    let bestStreak = db.user_profile.best_streak || 0;
    const todayStr = db.user_profile.simulated_date || getLocalDateString();
    
    if (allChecked && !wasCompleted) {
      if (db.user_profile.last_checkin_date !== todayStr) {
        const lastCheckin = db.user_profile.last_checkin_date;
        if (!lastCheckin) {
          currentStreak = 1;
        } else {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];
          if (lastCheckin === yesterdayStr) {
            currentStreak += 1;
          } else if (lastCheckin !== todayStr) {
            currentStreak = 1;
          }
        }
        if (currentStreak > bestStreak) bestStreak = currentStreak;
        db.user_profile.last_checkin_date = todayStr;
      }
    }

    const updatedProfile = {
      ...db.user_profile,
      xp: Math.max(0, db.user_profile.xp + xpGained),
      current_streak: currentStreak,
      best_streak: bestStreak
    };
    updatedProfile.level = Math.floor(Math.sqrt(updatedProfile.xp / 100)) + 1;

    setDb(prev => ({
      ...prev,
      calendar: updatedCalendar,
      user_profile: updatedProfile
    }));

    syncCalendarDay(day);
    syncProfile(updatedProfile);
  };

  const saveDayDetails = () => {
    if (!selectedDay) return;
    const updatedCalendar = [...db.calendar];
    const day = updatedCalendar.find(d => d.day_number === selectedDay.day_number);
    if (day) {
      day.notes = selectedDay.notes;
      day.time_spent_minutes = selectedDay.time_spent_minutes;
      day.rating = selectedDay.rating;
    }
    setDb(prev => ({ ...prev, calendar: updatedCalendar }));
    syncCalendarDay(day);
    setSelectedDay(null);
    showNotification("📅 Day details saved successfully.");
  };

  const handleSolveQuestion = (solvedState) => {
    const updatedQ = {
      ...selectedQuestion,
      solved: solvedState,
      solution_code: workspaceCode,
      notes: workspaceNotes,
      attempts: (selectedQuestion.attempts || 0) + (solvedState ? 1 : 0)
    };
    setSelectedQuestion(updatedQ);

    let list = getQuestionList(selectedQuestionCategory);
    const idx = list.findIndex(q => q.id === selectedQuestion.id);
    if (idx !== -1) list[idx] = updatedQ;

    let xpGained = 0;
    if (solvedState && !selectedQuestion.solved) {
      xpGained = 100;
      showNotification("🏆 Question Solved! +100 XP");
    }

    const updatedProfile = {
      ...db.user_profile,
      xp: db.user_profile.xp + xpGained
    };
    updatedProfile.level = Math.floor(Math.sqrt(updatedProfile.xp / 100)) + 1;

    setDb(prev => ({
      ...prev,
      user_profile: updatedProfile
    }));

    syncProfile(updatedProfile);
    syncQuestion(selectedQuestionCategory, updatedQ);
  };

  const toggleProject = (projectName, week, checked) => {
    const updatedProjects = [...db.projects];
    const proj = updatedProjects.find(p => p.name === projectName && p.week === week);
    if (!proj) return;

    proj.completed = checked;
    let xpGained = checked ? 500 : -500;

    if (checked) {
      showNotification("🚀 Megaproject Completed! +500 XP!");
    }

    const updatedProfile = {
      ...db.user_profile,
      xp: Math.max(0, db.user_profile.xp + xpGained)
    };
    updatedProfile.level = Math.floor(Math.sqrt(updatedProfile.xp / 100)) + 1;

    setDb(prev => ({
      ...prev,
      projects: updatedProjects,
      user_profile: updatedProfile
    }));

    syncProject(proj);
    syncProfile(updatedProfile);
  };

  const updateProjectFields = (name, week, fields) => {
    const updatedProjects = [...db.projects];
    const proj = updatedProjects.find(p => p.name === name && p.week === week);
    if (proj) {
      Object.assign(proj, fields);
    }
    setDb(prev => ({ ...prev, projects: updatedProjects }));
    syncProject(proj);
  };

  // Loading spinner layout
  if (loading || !db) {
    return (
      <div className="fixed inset-0 flex flex-col justify-center items-center bg-slate-50 gap-4">
        <Loader2 className="animate-spin text-brand-600 h-10 w-10" />
        <h2 className="text-lg font-bold text-slate-800 font-main">Loading Curriculum Cockpit...</h2>
      </div>
    );
  }

  // Authentication page layout with Tailwind
  if (!currentUser) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50 p-4 font-main">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl w-full max-w-md text-center">
          <div className="mb-6">
            <h2 className="text-2xl font-black text-slate-900 flex items-center justify-center gap-2">
              <Code className="text-brand-600 h-7 w-7" />
              DE Mastery Tracker
            </h2>
            <p className="text-xs text-slate-500 mt-2">
              {authMode === 'login' ? 'Enter credentials to load database session' : 'Create a new account on Neon Cloud'}
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4 text-left">
            {authMode === 'signup' && (
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Full Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
                  value={signupForm.name}
                  onChange={e => setSignupForm({ ...signupForm, name: e.target.value })}
                  placeholder="Enter your name"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Email Address</label>
              <input
                type="email"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
                value={authMode === 'login' ? loginForm.email : signupForm.email}
                onChange={e => authMode === 'login'
                  ? setLoginForm({ ...loginForm, email: e.target.value })
                  : setSignupForm({ ...signupForm, email: e.target.value })}
                placeholder="you@example.com"
              />
            </div>

            {authMode === 'signup' && (
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">DE Target Goal</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
                  value={signupForm.goal}
                  onChange={e => setSignupForm({ ...signupForm, goal: e.target.value })}
                  placeholder="e.g. Big Data Engineer"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Security PIN (6565)</label>
              <input
                type="password"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm text-center tracking-widest font-mono"
                maxLength="6"
                value={authMode === 'login' ? loginForm.pin : signupForm.pin}
                onChange={e => authMode === 'login'
                  ? setLoginForm({ ...loginForm, pin: e.target.value })
                  : setSignupForm({ ...signupForm, pin: e.target.value })}
                placeholder="••••"
              />
            </div>

            <button type="submit" className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg transition-colors text-sm mt-6">
              {authMode === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          </form>

          <div className="text-center mt-6 text-xs text-slate-500">
            {authMode === 'login' ? (
              <span>New student? <a href="#" className="text-brand-600 font-bold hover:underline" onClick={() => setAuthMode('signup')}>Create Account</a></span>
            ) : (
              <span>Already registered? <a href="#" className="text-brand-600 font-bold hover:underline" onClick={() => setAuthMode('login')}>Sign In</a></span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Filter QBank lists
  const filteredQBankList = getQuestionList(activeQBankTab).filter(item => {
    const searchVal = qbankFilters.search.toLowerCase();
    const matchesSearch = (item.question || item.title || '').toLowerCase().includes(searchVal) ||
      (item.category || '').toLowerCase().includes(searchVal) ||
      (item.topic || item.pattern || '').toLowerCase().includes(searchVal);

    let matchesDiff = true;
    if (qbankFilters.difficulty) {
      matchesDiff = (item.difficulty || '').toLowerCase() === qbankFilters.difficulty.toLowerCase();
    }

    let matchesStatus = true;
    if (qbankFilters.status) {
      const isSolved = item.solved;
      if (qbankFilters.status === 'solved') matchesStatus = isSolved;
      else if (qbankFilters.status === 'unsolved') matchesStatus = !isSolved;
    }

    return matchesSearch && matchesDiff && matchesStatus;
  });

  return (
    <div className="flex min-h-screen bg-slate-50 font-main">
      
      {/* ================= LEFT SIDEBAR ================= */}
      <aside className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col justify-between fixed h-screen overflow-y-auto z-40">
        <div>
          <div className="mb-8">
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Code className="text-brand-600 h-6 w-6" />
              DE Mastery
            </h1>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Curriculum Cockpit</div>
          </div>

          <nav className="space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'calendar', label: '182-Day Calendar', icon: Calendar },
              { id: 'qbank', label: 'Question Banks', icon: Code },
              { id: 'projects', label: 'Megaprojects', icon: Folder },
              { id: 'cheatsheets', label: 'Cheat Sheets', icon: FileText },
              { id: 'admin', label: 'Admin Cockpit', icon: Shield },
              { id: 'settings', label: 'Settings', icon: Settings },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <div
                  key={tab.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                    isActive ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-brand-700' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Profile and Signout panel */}
        <div className="border-t border-slate-200 pt-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-sm">
              {(db.user_profile?.name?.[0] || 'U').toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-bold text-slate-900 truncate">{db.user_profile?.name}</div>
              <div className="text-xs text-slate-500">Lvl {db.user_profile?.level} Student</div>
            </div>
          </div>
          <button
            className="w-full flex items-center justify-center gap-2 py-2 px-3 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            onClick={logout}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ================= MAIN CONTENT SPACE ================= */}
      <main className="flex-1 ml-64 p-8 min-h-screen">
        <header className="flex justify-between items-center border-b border-slate-200 pb-6 mb-8">
          <h2 className="text-2xl font-black text-slate-900">
            {activeTab === 'dashboard' && '📈 Student Dashboard'}
            {activeTab === 'calendar' && '📅 182-Day Curriculum Tracker'}
            {activeTab === 'qbank' && '💻 Coding & Concept Banks'}
            {activeTab === 'projects' && '🚀 Portfolio Megaprojects'}
            {activeTab === 'cheatsheets' && '📝 Developer Cheat Sheets'}
            {activeTab === 'admin' && '🛡️ Administrator Control Center'}
            {activeTab === 'settings' && '⚙️ Configuration & Settings'}
          </h2>

          {/* Streaks Widget */}
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 text-brand-700 rounded-full text-xs font-bold border border-brand-100">
              <Zap className="h-3.5 w-3.5 text-brand-600 fill-brand-600" />
              <span>{db.user_profile?.xp} XP</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-xs font-bold border border-amber-100">
              <Flame className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
              <span>{db.user_profile?.current_streak} Day Streak (Best: {db.user_profile?.best_streak})</span>
            </div>
          </div>
        </header>

        {/* ================= VIEW 1: DASHBOARD ================= */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Overview Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Level</span>
                <span className="text-3xl font-extrabold text-brand-600 mt-2">{db.user_profile?.level}</span>
                <span className="text-xs text-slate-500 mt-2">Next level in {((db.user_profile?.level || 1) * 100) - (db.user_profile?.xp || 0)} XP</span>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Completed Days</span>
                <span className="text-3xl font-extrabold text-slate-900 mt-2">{db.calendar.filter(d => d.completed).length} / 182</span>
                <span className="text-xs text-slate-500 mt-2">{Math.round((db.calendar.filter(d => d.completed).length / 182) * 100)}% of curriculum finished</span>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Solved Problems</span>
                <span className="text-3xl font-extrabold text-slate-900 mt-2">
                  {getQuestionList('sql').filter(q => q.solved).length + getQuestionList('dsa').filter(q => q.solved).length}
                </span>
                <span className="text-xs text-slate-500 mt-2">SQL: {getQuestionList('sql').filter(q => q.solved).length} | DSA: {getQuestionList('dsa').filter(q => q.solved).length}</span>
              </div>
            </div>

            {/* Target Goal Panel */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider block border-b border-slate-100 pb-3 mb-4">🎯 Target Career Objective</h3>
              <p className="text-sm text-slate-700">
                <strong>Target Role:</strong> {db.user_profile?.goal || 'Not specified (go to Settings)'}
              </p>
              <p className="text-sm text-slate-700 mt-2">
                <strong>Companies Focus:</strong> {db.user_profile?.target_companies?.join(', ') || 'Not specified'}
              </p>
            </div>

            {/* Today's Agenda Panel */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-4 mb-4 flex items-center gap-2">
                <Calendar className="text-brand-600 h-5 w-5" />
                Today's Agenda (Day {db.calendar.findIndex(d => !d.completed) + 1})
              </h3>
              {(() => {
                const todayIndex = db.calendar.findIndex(d => !d.completed);
                const today = todayIndex !== -1 ? db.calendar[todayIndex] : db.calendar[0];
                if (!today) return <span className="text-slate-500 text-sm">All days finished! Excellent job.</span>;

                return (
                  <div className="space-y-4">
                    <div className="text-sm font-semibold text-brand-700 bg-brand-50/50 px-3 py-1 rounded-md inline-block">
                      Day Topic: {today.topic}
                    </div>

                    <div className="space-y-3 pt-2">
                      <label className="flex items-center gap-3 text-sm text-slate-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
                          checked={today.morning_completed}
                          onChange={() => toggleCalendarTask(today.day_number, 'morning_completed')}
                        />
                        <span>🌅 Morning Task: {today.morning_task}</span>
                      </label>
                      <label className="flex items-center gap-3 text-sm text-slate-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
                          checked={today.afternoon_completed}
                          onChange={() => toggleCalendarTask(today.day_number, 'afternoon_completed')}
                        />
                        <span>☀️ Afternoon Task: {today.afternoon_task}</span>
                      </label>
                      <label className="flex items-center gap-3 text-sm text-slate-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
                          checked={today.evening_completed}
                          onChange={() => toggleCalendarTask(today.day_number, 'evening_completed')}
                        />
                        <span>🌙 Evening Task: {today.evening_task}</span>
                      </label>
                    </div>

                    <button
                      className="py-2 px-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg transition-colors text-xs mt-4 flex items-center gap-2"
                      onClick={() => setSelectedDay(today)}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Add Study Minutes & Reflections
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ================= VIEW 2: 182-DAY CALENDAR ================= */}
        {activeTab === 'calendar' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 lg:grid-cols-9 gap-4">
            {db.calendar.map(day => (
              <div
                key={day.day_number}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between h-24 shadow-sm hover:border-brand-500 hover:shadow-md ${
                  day.completed ? 'bg-teal-50/50 border-teal-200' : (day.penalized ? 'bg-red-50/50 border-red-200' : 'bg-white border-slate-200')
                }`}
                onClick={() => setSelectedDay(day)}
              >
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-slate-400">Day {day.day_number}</span>
                  {day.completed && <Check className="text-teal-600 h-3.5 w-3.5 font-black" />}
                  {day.penalized && <AlertTriangle className="text-red-500 h-3.5 w-3.5" />}
                </div>
                
                <span className="text-xs font-bold text-slate-700 line-clamp-2 mt-1">
                  {day.topic}
                </span>

                <div className="flex gap-1.5 mt-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${day.morning_completed ? 'bg-brand-500' : 'bg-slate-200'}`}></span>
                  <span className={`w-1.5 h-1.5 rounded-full ${day.afternoon_completed ? 'bg-brand-500' : 'bg-slate-200'}`}></span>
                  <span className={`w-1.5 h-1.5 rounded-full ${day.evening_completed ? 'bg-brand-500' : 'bg-slate-200'}`}></span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ================= VIEW 3: QUESTION BANKS ================= */}
        {activeTab === 'qbank' && (
          <div className="flex gap-8">
            
            {/* Left Bank Picker */}
            <div className="w-60 flex flex-col gap-1.5 flex-shrink-0">
              {[
                { id: 'sql', label: '💾 SQL Coding' },
                { id: 'dsa', label: '🧩 DSA Algorithms' },
                { id: 'pyspark', label: '📊 PySpark Big Data' },
                { id: 'concepts', label: '📚 Core DE Concepts' },
                { id: 'interview', label: '🎙️ Scenario Interviews' },
              ].map(sub => (
                <div
                  key={sub.id}
                  className={`px-4 py-3 rounded-xl text-sm font-bold cursor-pointer transition-colors ${
                    activeQBankTab === sub.id ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  onClick={() => setActiveQBankTab(sub.id)}
                >
                  {sub.label}
                </div>
              ))}
            </div>

            {/* Right List Grid */}
            <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm p-6 overflow-hidden">
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search question, tags, patterns..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
                    value={qbankFilters.search}
                    onChange={e => setQbankFilters({ ...qbankFilters, search: e.target.value })}
                  />
                </div>
                
                <select
                  className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm bg-white"
                  value={qbankFilters.difficulty}
                  onChange={e => setQbankFilters({ ...qbankFilters, difficulty: e.target.value })}
                >
                  <option value="">All Difficulties</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>

                <select
                  className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm bg-white"
                  value={qbankFilters.status}
                  onChange={e => setQbankFilters({ ...qbankFilters, status: e.target.value })}
                >
                  <option value="">All Statuses</option>
                  <option value="solved">Solved</option>
                  <option value="unsolved">Unsolved</option>
                </select>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <th className="pb-3 text-center w-12">ID</th>
                      <th className="pb-3">Problem</th>
                      <th className="pb-3">Category</th>
                      {activeQBankTab === 'sql' && <th className="pb-3">Topic</th>}
                      {activeQBankTab === 'dsa' && <th className="pb-3">Pattern</th>}
                      {(activeQBankTab === 'sql' || activeQBankTab === 'dsa') && <th className="pb-3">Difficulty</th>}
                      <th className="pb-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQBankList.map(item => (
                      <tr
                        key={item.id}
                        onClick={() => {
                          setSelectedQuestion(item);
                          setSelectedQuestionCategory(activeQBankTab);
                          setWorkspaceCode(item.solution_code || '');
                          setWorkspaceNotes(item.notes || '');
                          setWorkspaceTab('code');
                          setAiSubTab('schema');
                        }}
                        className="border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer text-sm font-main"
                      >
                        <td className="py-4 text-center text-slate-400">#{item.id}</td>
                        <td className="py-4 font-bold text-slate-800">{item.question || item.title}</td>
                        <td className="py-4 text-slate-600">{item.category}</td>
                        {activeQBankTab === 'sql' && <td className="py-4"><code className="font-code text-xs px-2 py-0.5 bg-slate-100 rounded text-slate-700">{item.topic}</code></td>}
                        {activeQBankTab === 'dsa' && <td className="py-4 text-slate-600">{item.pattern}</td>}
                        {(activeQBankTab === 'sql' || activeQBankTab === 'dsa') && (
                          <td className="py-4">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              (item.difficulty || '').toLowerCase() === 'easy' ? 'bg-emerald-50 text-emerald-700' :
                              ((item.difficulty || '').toLowerCase() === 'medium' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700')
                            }`}>
                              {item.difficulty}
                            </span>
                          </td>
                        )}
                        <td className="py-4">
                          {item.solved ? (
                            <span className="text-[10px] font-bold bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">✓ Solved</span>
                          ) : (
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Unsolved</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredQBankList.length === 0 && (
                      <tr>
                        <td colSpan="7" className="text-center py-10 text-slate-400 text-sm">
                          No questions match current search filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        )}

        {/* ================= VIEW 4: MEGAPROJECTS ================= */}
        {activeTab === 'projects' && (
          <div className="space-y-6">
            {db.projects.map(proj => (
              <div key={`${proj.name}-${proj.week}`} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold text-brand-600 uppercase tracking-widest bg-brand-50 px-2.5 py-0.5 rounded-full">
                      Month {Math.ceil(proj.week / 4)} | Week {proj.week}
                    </span>
                    <h3 className="text-lg font-black text-slate-800 mt-2">{proj.name}</h3>
                  </div>

                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
                      checked={proj.completed || false}
                      onChange={e => toggleProject(proj.name, proj.week, e.target.checked)}
                    />
                    <span>Mark Completed</span>
                  </label>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">{proj.description}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">GitHub Repository URL</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
                      placeholder="https://github.com/username/project"
                      value={proj.github_url || ''}
                      onChange={e => updateProjectFields(proj.name, proj.week, { github_url: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Duration (Hours Spent)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
                      min="0"
                      value={proj.time_spent_hours || 0}
                      onChange={e => updateProjectFields(proj.name, proj.week, { time_spent_hours: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Development Notes & Architecture doubts</label>
                  <textarea
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm min-h-[60px]"
                    value={proj.notes || ''}
                    placeholder="Write project highlights, pipelines, Spark configurations or problems encountered..."
                    onChange={e => updateProjectFields(proj.name, proj.week, { notes: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ================= VIEW 5: CHEAT SHEETS ================= */}
        {activeTab === 'cheatsheets' && (
          <div className="space-y-6">
            {Object.keys(db.cheat_sheets).map(key => {
              const sheet = db.cheat_sheets[key];
              return (
                <div key={key} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-base font-extrabold text-brand-700 mb-3">
                    📝 {sheet.title} Syntax Checklist
                  </h3>
                  <textarea
                    className="w-full p-4 border border-slate-200 rounded-xl font-code text-xs leading-relaxed focus:outline-none focus:border-brand-500 min-h-[220px]"
                    value={sheet.content || ''}
                    onChange={e => {
                      const updatedSheets = { ...db.cheat_sheets };
                      updatedSheets[key].content = e.target.value;
                      setDb(prev => ({ ...prev, cheat_sheets: updatedSheets }));
                      syncCheatSheet(key, updatedSheets[key]);
                    }}
                    placeholder={`Write your custom ${sheet.title} cheat sheets, syntax, commands, PySpark setups...`}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* ================= VIEW 6: ADMIN COCKPIT ================= */}
        {activeTab === 'admin' && (
          <div>
            {!adminAuthenticated ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm max-w-sm mx-auto text-center mt-12 space-y-4">
                <h3 className="text-lg font-black text-slate-800 flex items-center justify-center gap-2">
                  <Lock className="text-brand-600 h-5 w-5" />
                  Admin Gateway
                </h3>
                <form onSubmit={handleAdminVerify} className="space-y-3">
                  <input
                    type="password"
                    placeholder="Enter Admin PIN"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm text-center"
                    value={adminPinInput}
                    onChange={e => setAdminPinInput(e.target.value)}
                  />
                  <button type="submit" className="w-full py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-sm transition-colors">
                    Verify Access
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex gap-6">
                
                {/* Sidebar directories */}
                <div className="w-72 bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 flex-shrink-0 h-[80vh] overflow-y-auto">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
                      value={adminSearch}
                      onChange={e => setAdminSearch(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1 overflow-y-auto flex-1">
                    {adminUsers
                      .filter(u => u.name.toLowerCase().includes(adminSearch.toLowerCase()) || u.email.toLowerCase().includes(adminSearch.toLowerCase()))
                      .map(u => (
                        <div
                          key={u.id}
                          className={`p-3 rounded-lg text-xs font-semibold cursor-pointer transition-all flex justify-between items-center ${
                            adminSelectedUser?.id === u.id ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                          }`}
                          onClick={() => selectUserAdminInspect(u)}
                        >
                          <div>
                            <div className="font-bold">{u.name}</div>
                            <div className="text-[10px] opacity-80 mt-0.5">{u.email}</div>
                          </div>
                          <button
                            className="py-1 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-md text-[10px] font-bold"
                            onClick={e => {
                              e.stopPropagation();
                              deleteUserAccount(u.id, u.name);
                            }}
                          >
                            Wipe
                          </button>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Main Inspector Pane */}
                <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-6 h-[80vh] overflow-y-auto">
                  {adminSelectedUser ? (
                    <div className="space-y-6">
                      <h3 className="text-lg font-black text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                        <User className="text-brand-600 h-5 w-5" />
                        Student details: {adminSelectedUser.name}
                      </h3>
                      
                      <div className="flex gap-2 border-b border-slate-100 pb-3">
                        {['overview', 'calendar', 'code'].map(t => (
                          <button
                            key={t}
                            className={`py-1.5 px-3 rounded-lg text-xs font-bold capitalize transition-colors ${
                              adminInspectTab === t ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                            }`}
                            onClick={() => setAdminInspectTab(t)}
                          >
                            {t}
                          </button>
                        ))}
                      </div>

                      {/* Admin Tab 1: Overview */}
                      {adminInspectTab === 'overview' && (
                        <div className="grid grid-cols-2 gap-6">
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Level & XP</span>
                            <span className="text-2xl font-black text-slate-800 mt-1 block">Level {adminSelectedUser.level}</span>
                            <span className="text-xs text-slate-500 mt-1 block">{adminSelectedUser.xp} accumulated XP</span>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Daily Streaks</span>
                            <span className="text-2xl font-black text-slate-800 mt-1 block">{adminSelectedUser.current_streak} Days</span>
                            <span className="text-xs text-slate-500 mt-1 block">Best streak: {adminSelectedUser.best_streak} Days</span>
                          </div>
                        </div>
                      )}

                      {/* Admin Tab 2: Calendar */}
                      {adminInspectTab === 'calendar' && adminSelectedUserProgress && (
                        <div className="space-y-6">
                          <div className="grid grid-cols-10 gap-2">
                            {adminSelectedUserProgress.calendar.map(day => (
                              <div
                                key={day.day_number}
                                onClick={() => setAdminInspectDay(day)}
                                className={`py-2 px-1 text-[10px] font-bold text-center rounded-lg cursor-pointer transition-all border ${
                                  adminInspectDay?.day_number === day.day_number ? 'border-brand-500 ring-2 ring-brand-100' : 'border-transparent'
                                } ${
                                  day.completed ? 'bg-teal-100 text-teal-800' : (day.penalized ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600')
                                }`}
                              >
                                D{day.day_number}
                              </div>
                            ))}
                          </div>

                          {adminInspectDay && (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                              <h4 className="text-sm font-bold text-slate-800">Day {adminInspectDay.day_number} Logs</h4>
                              <p className="text-xs text-slate-600"><strong>Curriculum Topic:</strong> {adminInspectDay.topic}</p>
                              <p className="text-xs text-slate-600"><strong>Study Time logged:</strong> {adminInspectDay.time_spent_minutes} mins</p>
                              <p className="text-xs text-slate-600"><strong>Student Reflections:</strong> {adminInspectDay.notes || 'None written.'}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Admin Tab 3: Code solutions */}
                      {adminInspectTab === 'code' && adminSelectedUserProgress && (
                        <div className="flex gap-6">
                          <div className="w-56 space-y-3 flex-shrink-0">
                            <select
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-xs bg-white"
                              value={adminInspectCategory}
                              onChange={e => setAdminInspectCategory(e.target.value)}
                            >
                              <option value="sql">SQL Coding</option>
                              <option value="dsa">DSA Algorithmic</option>
                              <option value="pyspark">PySpark</option>
                            </select>

                            <div className="space-y-1 overflow-y-auto max-h-[300px] border border-slate-100 rounded-xl p-2 bg-slate-50">
                              {adminSelectedUserProgress[`${adminInspectCategory === 'sql' ? 'sql_question_bank' : (adminInspectCategory === 'dsa' ? 'dsa_problems' : 'pyspark_questions')}`]
                                .filter(q => q.solved)
                                .map(q => (
                                  <div
                                    key={q.id}
                                    onClick={() => setAdminInspectQId(q.id)}
                                    className={`px-3 py-2 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                                      adminInspectQId === q.id ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
                                    }`}
                                  >
                                    #{q.id} {q.question || q.title}
                                  </div>
                                ))}
                            </div>
                          </div>

                          <div className="flex-1">
                            {(() => {
                              const list = adminSelectedUserProgress[`${adminInspectCategory === 'sql' ? 'sql_question_bank' : (adminInspectCategory === 'dsa' ? 'dsa_problems' : 'pyspark_questions')}`];
                              const q = list.find(item => item.id === adminInspectQId);
                              if (!q) return <span className="text-slate-400 text-xs">Select a solved question to inspect their workspace.</span>;

                              return (
                                <div className="space-y-3">
                                  <h4 className="text-sm font-bold text-slate-800">#{q.id} {q.question || q.title}</h4>
                                  <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl font-code text-xs overflow-x-auto max-h-[250px]">
                                    <code>{q.solution_code || 'No solution code submitted.'}</code>
                                  </pre>
                                  <div className="text-xs text-slate-600">
                                    <strong>Personal Notes:</strong> {q.notes || 'None written.'}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                    </div>
                  ) : (
                    <div className="text-center py-20 text-slate-400 text-sm">
                      Select a student directory account to inspect complete dashboard metrics.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= VIEW 7: SETTINGS ================= */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3">
                👤 Edit Student Profile
              </h3>
              
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Full Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
                  value={db.user_profile?.name}
                  onChange={e => {
                    const profile = { ...db.user_profile, name: e.target.value };
                    setDb(prev => ({ ...prev, user_profile: profile }));
                    syncProfile(profile);
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Email Address</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-100 text-slate-500 cursor-not-allowed"
                  value={db.user_profile?.email}
                  disabled
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Career Target Goal</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
                  value={db.user_profile?.goal}
                  onChange={e => {
                    const profile = { ...db.user_profile, goal: e.target.value };
                    setDb(prev => ({ ...prev, user_profile: profile }));
                    syncProfile(profile);
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Target Companies (Comma separated)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
                  value={db.user_profile?.target_companies?.join(', ')}
                  onChange={e => {
                    const profile = { ...db.user_profile, target_companies: e.target.value.split(',').map(s => s.trim()).filter(Boolean) };
                    setDb(prev => ({ ...prev, user_profile: profile }));
                    syncProfile(profile);
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Daily Study Target (Hours)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
                  min="1"
                  max="24"
                  value={db.user_profile?.daily_study_hours}
                  onChange={e => {
                    const profile = { ...db.user_profile, daily_study_hours: parseInt(e.target.value) || 5 };
                    setDb(prev => ({ ...prev, user_profile: profile }));
                    syncProfile(profile);
                  }}
                />
              </div>

              <div className="border-t border-slate-100 pt-4 mt-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1 text-brand-600">🤖 Gemini API Key</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
                  placeholder="Paste your Gemini key here"
                  value={db.user_profile?.gemini_api_key}
                  onChange={e => {
                    const profile = { ...db.user_profile, gemini_api_key: e.target.value };
                    setDb(prev => ({ ...prev, user_profile: profile }));
                    syncProfile(profile);
                  }}
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Needed for AI Coach reviewing, grading code, and custom doubts.</span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1 text-teal-700">🔗 Deployed Backend API URL</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
                  placeholder="e.g. https://your-backend.onrender.com"
                  value={localStorage.getItem('de_tracker_backend_url') || ''}
                  onChange={e => {
                    const val = e.target.value.trim();
                    if (val) localStorage.setItem('de_tracker_backend_url', val);
                    else localStorage.removeItem('de_tracker_backend_url');
                    showNotification("Backend URL updated. Reloading page...");
                    setTimeout(() => window.location.reload(), 1200);
                  }}
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Leave blank for local environment. Reloads application on change.</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 h-fit">
              <h3 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3">
                ⚙️ Reset Tracker State
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                If you wish to wipe all check-ins, custom notes, syntax sheets, streaks, levels, and solutions to start completely fresh from Day 1, execute this reset trigger.
              </p>
              <button
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg text-xs transition-colors"
                onClick={handleResetDatabase}
              >
                Wipe & Reset Database Progress
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ================= MODAL 1: CALENDAR DAY DETAIL DRAWER ================= */}
      {selectedDay && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-lg font-black text-slate-800">📅 Day {selectedDay.day_number} Detail Config</h3>
              <button
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                onClick={() => setSelectedDay(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-sm">
                <strong>Curriculum Topic:</strong> <span className="text-brand-600 font-bold">{selectedDay.topic}</span>
              </div>

              {/* Task list quick display */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2 text-xs text-slate-600 leading-relaxed">
                <div>🌅 <strong>Morning:</strong> {selectedDay.morning_task}</div>
                <div>☀️ <strong>Afternoon:</strong> {selectedDay.afternoon_task}</div>
                <div>🌙 <strong>Evening:</strong> {selectedDay.evening_task}</div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Study Duration Gained (Minutes)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
                  min="0"
                  value={selectedDay.time_spent_minutes}
                  onChange={e => setSelectedDay({ ...selectedDay, time_spent_minutes: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Confidence Rating (1-5)</label>
                <select
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm bg-white"
                  value={selectedDay.rating || ''}
                  onChange={e => setSelectedDay({ ...selectedDay, rating: parseInt(e.target.value) || null })}
                >
                  <option value="">Select confidence</option>
                  <option value="1">1 - Struggled</option>
                  <option value="2">2 - Tough</option>
                  <option value="3">3 - Ok</option>
                  <option value="4">4 - Confident</option>
                  <option value="5">5 - Mastered</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Daily reflections, notes or logical doubts</label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-sm min-h-[100px]"
                  value={selectedDay.notes}
                  placeholder="What did you learn today? Edge cases? Notes on Spark jobs?"
                  onChange={e => setSelectedDay({ ...selectedDay, notes: e.target.value })}
                />
              </div>

              <div className="flex gap-2.5 justify-end border-t border-slate-100 pt-4">
                <button
                  className="py-2 px-4 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-600 transition-colors"
                  onClick={() => setSelectedDay(null)}
                >
                  Cancel
                </button>
                <button
                  className="py-2 px-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg text-xs transition-colors"
                  onClick={saveDayDetails}
                >
                  Save Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: QUESTION WORKSPACE MODAL ================= */}
      {selectedQuestion && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedQuestion(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex justify-between items-start border-b border-slate-200 p-6 bg-slate-50">
              <div>
                <span className={`text-[10px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full ${
                  (selectedQuestion.difficulty || '').toLowerCase() === 'easy' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                  ((selectedQuestion.difficulty || '').toLowerCase() === 'medium' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-rose-50 text-rose-700 border border-rose-100')
                }`}>
                  {selectedQuestion.difficulty || 'Concept'}
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-2">
                  #{selectedQuestion.id} {selectedQuestion.question || selectedQuestion.title}
                </h3>
              </div>
              <button
                className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                onClick={() => setSelectedQuestion(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Split Pane Details layout */}
            <div className="flex flex-1 overflow-hidden">
              
              {/* Left pane: Question description */}
              <div className="w-1/2 p-6 overflow-y-auto border-r border-slate-200 space-y-4 bg-slate-50/50">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Question Details</h4>
                <div className="text-sm text-slate-700 leading-relaxed font-main">
                  {selectedQuestion.description || selectedQuestion.question || "Core Data Engineering learning item. Write down your solution notes."}
                </div>

                {selectedQuestion.de_relevance && (
                  <div className="p-4 bg-teal-50/60 rounded-xl border border-teal-100 border-l-4 border-l-brand-600 space-y-1">
                    <span className="text-[10px] font-bold text-brand-700 uppercase tracking-widest">DE Relevance</span>
                    <p className="text-xs text-slate-600 leading-relaxed">{selectedQuestion.de_relevance}</p>
                  </div>
                )}
              </div>

              {/* Right pane: Tabs and editors */}
              <div className="w-1/2 flex flex-col justify-between p-6 overflow-y-auto">
                <div className="flex gap-1.5 border-b border-slate-200 pb-3 mb-4">
                  {['code', 'notes', 'coach'].map(t => (
                    <button
                      key={t}
                      className={`py-1.5 px-3.5 rounded-lg text-xs font-bold capitalize transition-colors ${
                        workspaceTab === t ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                      onClick={() => setWorkspaceTab(t)}
                    >
                      {t === 'code' ? '💻 Editor' : (t === 'notes' ? '📝 Notes' : '🤖 AI Coach')}
                    </button>
                  ))}
                </div>

                {/* Subtab 1: Code editor */}
                {workspaceTab === 'code' && (
                  <div className="flex-1 flex flex-col justify-between gap-4">
                    <textarea
                      className="w-full flex-1 p-4 bg-slate-900 text-slate-100 rounded-xl font-code text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-500/20 max-h-[350px] min-h-[250px]"
                      value={workspaceCode}
                      onChange={e => setWorkspaceCode(e.target.value)}
                      placeholder={selectedQuestionCategory === 'sql' ? "-- Write your SQL query solution here..." : "# Write your Python/PySpark solution here..."}
                    />

                    <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
                          checked={selectedQuestion.solved || false}
                          onChange={e => handleSolveQuestion(e.target.checked)}
                        />
                        <span>Mark as Solved</span>
                      </label>
                      <button
                        className="py-2 px-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-2"
                        onClick={() => handleSolveQuestion(true)}
                      >
                        <Save className="h-3.5 w-3.5" />
                        Save Solution
                      </button>
                    </div>
                  </div>
                )}

                {/* Subtab 2: Notes */}
                {workspaceTab === 'notes' && (
                  <div className="flex-1 flex flex-col justify-between gap-4">
                    <textarea
                      className="w-full flex-1 p-4 border border-slate-200 rounded-xl font-main text-xs leading-relaxed focus:outline-none focus:border-brand-500 max-h-[350px] min-h-[250px]"
                      value={workspaceNotes}
                      onChange={e => setWorkspaceNotes(e.target.value)}
                      placeholder="Write your study notes, doubts, edge cases or alternative approaches..."
                    />
                    <button
                      className="py-2 px-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg text-xs transition-colors self-end"
                      onClick={() => handleSolveQuestion(selectedQuestion.solved)}
                    >
                      Save Notes
                    </button>
                  </div>
                )}

                {/* Subtab 3: AI Coach */}
                {workspaceTab === 'coach' && (
                  <div className="flex-1 flex flex-col justify-between gap-4">
                    <div className="flex gap-2 border-b border-slate-100 pb-2">
                      {['schema', 'hint', 'chat'].map(t => (
                        <button
                          key={t}
                          className={`py-1 px-2.5 rounded-lg text-[10px] font-bold capitalize transition-colors ${
                            aiSubTab === t ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-50'
                          }`}
                          onClick={() => setAiSubTab(t)}
                        >
                          {t === 'schema' ? '📊 Model Tables' : (t === 'hint' ? '💡 Grade Solution' : '💬 Chat doubts')}
                        </button>
                      ))}
                    </div>

                    <div className="flex-1 border border-slate-200 rounded-xl p-4 bg-slate-50 overflow-y-auto text-xs leading-relaxed max-h-[260px] min-h-[220px]">
                      {aiLoading && (
                        <div className="flex flex-col justify-center items-center gap-2 pt-12 text-slate-500">
                          <Loader2 className="animate-spin h-6 w-6 text-brand-600" />
                          <span>Coach is formulating review...</span>
                        </div>
                      )}

                      {aiError && (
                        <span className="text-rose-600 font-bold">❌ Error: {aiError}</span>
                      )}

                      {!aiLoading && !aiError && (
                        <>
                          {/* Schema/Tables */}
                          {aiSubTab === 'schema' && (
                            selectedQuestion.ai_schema_context ? (
                              <div dangerouslySetInnerHTML={{ __html: parseMarkdown(selectedQuestion.ai_schema_context) }}></div>
                            ) : (
                              <div className="flex flex-col items-center gap-3 pt-12 text-slate-500 text-center">
                                <HelpCircle className="h-8 w-8 text-slate-300" />
                                <span>No reference database schemas generated yet.</span>
                                <button
                                  className="py-1.5 px-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg text-[10px] transition-colors"
                                  onClick={generateSchemaMockTables}
                                >
                                  🤖 Generate Reference Tables & Schema
                                </button>
                              </div>
                            )
                          )}

                          {/* Grade code */}
                          {aiSubTab === 'hint' && (
                            selectedQuestion.ai_code_review_hint ? (
                              <div dangerouslySetInnerHTML={{ __html: parseMarkdown(selectedQuestion.ai_code_review_hint) }}></div>
                            ) : (
                              <div className="flex flex-col items-center gap-3 pt-12 text-slate-500 text-center">
                                <TrendingUp className="h-8 w-8 text-slate-300" />
                                <span>Coach has not graded your query yet.</span>
                                <button
                                  className="py-1.5 px-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg text-[10px] transition-colors"
                                  onClick={evaluateAndRateSolution}
                                >
                                  🤖 Evaluate & Rate Code (1-10)
                                </button>
                              </div>
                            )
                          )}

                          {/* Chat */}
                          {aiSubTab === 'chat' && (
                            <div className="space-y-3">
                              {(selectedQuestion.ai_chat_history || []).length === 0 ? (
                                <div className="p-3 bg-brand-50/50 border border-brand-100 rounded-lg text-brand-700 flex gap-2">
                                  <MessageSquare className="h-4 w-4 mt-0.5 text-brand-600 flex-shrink-0" />
                                  <span>👋 I am your AI Coach! Ask me doubts about your queries, logic, or syntax. I'll guide you to the answer.</span>
                                </div>
                              ) : (
                                (selectedQuestion.ai_chat_history || []).map((msg, idx) => (
                                  <div
                                    key={idx}
                                    className={`p-2.5 rounded-xl text-xs ${
                                      msg.role === 'coach' ? 'bg-brand-50/50 border border-brand-100 text-slate-800' : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    <strong>{msg.role === 'coach' ? '🤖 Coach' : '👤 You'}:</strong>
                                    <div dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.text) }} className="mt-1"></div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Doubts chat entry input */}
                    {aiSubTab === 'chat' && (
                      <form onSubmit={sendAICustomDoubt} className="flex gap-2 mt-2">
                        <input
                          type="text"
                          placeholder="Type doubts (e.g. why do we need CTE here?)..."
                          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-xs bg-white"
                          value={aiChatQuery}
                          onChange={e => setAiChatQuery(e.target.value)}
                        />
                        <button type="submit" className="py-2 px-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg text-xs transition-colors">
                          Ask
                        </button>
                      </form>
                    )}

                  </div>
                )}

              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
