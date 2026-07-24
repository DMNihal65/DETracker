import React, { useState, useEffect, useRef } from 'react';

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
    return `<pre style="background-color: #0f172a; color: #e2e8f0; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 12px; overflow-x: auto; margin: 8px 0; text-align: left;"><code>${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="font-family: monospace; background-color: #f1f5f9; padding: 2px 4px; border-radius: 4px; font-size: 11px; color: #0d9488;">$1</code>');

  // Bold text
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h4 style="font-size: 13px; font-weight: 700; margin-top: 12px; color: #0f172a;">$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3 style="font-size: 14px; font-weight: 800; margin-top: 16px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2 style="font-size: 16px; font-weight: 800; margin-top: 20px; color: #0f172a;">$1</h2>');

  // Unordered Lists
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li style="margin-left: 16px; list-style-type: disc; font-size: 12px; color: #475569;">$1</li>');

  // Ordered Lists
  html = html.replace(/^\s*\d+\.\s+(.*$)/gim, '<li style="margin-left: 16px; list-style-type: decimal; font-size: 12px; color: #475569;">$1</li>');

  // Simple Table parser
  const lines = html.split('\n');
  let inTable = false;
  let tableHTML = '';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (line.startsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableHTML = '<table style="width:100%; border-collapse:collapse; margin: 12px 0; font-size: 12px; border: 1px solid #e2e8f0;">';
      }

      let cells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
      if (line.includes('---')) continue;

      tableHTML += '<tr style="border-bottom: 1px solid #e2e8f0;">';
      cells.forEach(cell => {
        if (tableHTML.indexOf('</th>') === -1) {
          tableHTML += `<th style="background-color: #f8fafc; padding: 8px 12px; font-weight: 700; text-align: left; border-right: 1px solid #e2e8f0;">${cell}</th>`;
        } else {
          tableHTML += `<td style="padding: 8px 12px; border-right: 1px solid #e2e8f0;">${cell}</td>`;
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
  html = html.replace(/\n\n/g, '<p style="margin: 8px 0; font-size: 12px; color: #475569;"></p>');

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
    }, 4000);
  };

  // 1. Initial Load: Fetch Curriculum and Check Session
  useEffect(() => {
    async function init() {
      try {
        // Fetch dynamic curriculum configuration
        const resCurriculum = await fetch(API_BASE_URL + '/de_master_roadmap_database.json');
        if (!resCurriculum.ok) throw new Error("Could not load curriculum data.");
        const baselineData = await resCurriculum.json();

        // Check local storage session
        const sessionUser = localStorage.getItem('de_tracker_user');
        if (sessionUser) {
          const parsedUser = JSON.parse(sessionUser);
          setCurrentUser(parsedUser);

          // Fetch user progress from database
          const resProgress = await fetch(API_BASE_URL + `/api/user/${parsedUser.id}/data`);
          if (!resProgress.ok) {
            // Force logout if user session is invalid on database
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

  // Sync session authentication
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

  // 2. Synchronizers communicating client updates to PostgreSQL
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

  const syncMilestone = async (milestone) => {
    if (!currentUser) return;
    try {
      await fetch(API_BASE_URL + `/api/user/${currentUser.id}/update-milestone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          milestone_name: milestone.name,
          completed: milestone.completed
        })
      });
    } catch (err) {
      console.error("Milestone sync error:", err);
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
        }, 1500);
      } else {
        showNotification("Failed to reset database progress.", "error");
      }
    } catch (err) {
      showNotification("Error communicating reset trigger to server.", "error");
    }
  };

  // 3. User Authentication Submit Triggers
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

  // 4. Admin Authentication & Listing Triggers
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
        showNotification("User account wiped successfully.", "success");
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
        // Merge progress against baseline just for admin rendering
        const resBaseline = await fetch(API_BASE_URL + '/de_master_roadmap_database.json');
        const baseline = await resBaseline.json();
        mergeUserProgress(baseline, progress);
        setAdminSelectedUserProgress(baseline);
      }
    } catch (err) {
      alert("Failed loading user inspection payload.");
    }
  };

  // 5. Upgraded Gemini AI Coach Integration
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

      // Update in QBank collection
      let list = getQuestionList(selectedQuestionCategory);
      const idx = list.findIndex(q => q.id === selectedQuestion.id);
      if (idx !== -1) list[idx] = updatedQ;

      // Update profile XP (+10 for generating context)
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

      // Update in QBank collection
      let list = getQuestionList(selectedQuestionCategory);
      const idx = list.findIndex(q => q.id === selectedQuestion.id);
      if (idx !== -1) list[idx] = updatedQ;

      // Update profile XP (+15 for asking review)
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

    // Build prompt with conversation history context
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

      // Update in QBank collection
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

  // 6. Checkbox Checkin System (Calendar Day Completion)
  const toggleCalendarTask = (dayNumber, taskKey) => {
    const updatedCalendar = [...db.calendar];
    const day = updatedCalendar.find(d => d.day_number === dayNumber);
    if (!day) return;

    day[taskKey] = !day[taskKey];

    // Auto-calculate day overall completion status
    const allChecked = day.morning_completed && day.afternoon_completed && day.evening_completed;
    const wasCompleted = day.completed;
    day.completed = allChecked;

    // Gain XP for completing checklists
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

    // Full day bonus
    if (allChecked && !wasCompleted) {
      xpGained += 50;
      showNotification("☀️ Day fully completed! +50 XP bonus!");
    } else if (!allChecked && wasCompleted) {
      xpGained -= 50;
    }

    // Check streak adjustments if simulated date matches checkin
    let currentStreak = db.user_profile.current_streak || 0;
    let bestStreak = db.user_profile.best_streak || 0;
    const todayStr = db.user_profile.simulated_date || getLocalDateString();
    
    if (allChecked && !wasCompleted) {
      if (db.user_profile.last_checkin_date !== todayStr) {
        // Increment streak if last checkin was yesterday or none
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
            currentStreak = 1; // Streak broken, restart
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

    // Trigger API syncs
    syncCalendarDay(day);
    syncProfile(updatedProfile);
  };

  // Save Day Detail inputs (duration and notes)
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

  // Submit coding workspace question completion
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

    // Award XP on solve
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

  // Projects Completion Toggle
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

  // Project Fields Update
  const updateProjectFields = (name, week, fields) => {
    const updatedProjects = [...db.projects];
    const proj = updatedProjects.find(p => p.name === name && p.week === week);
    if (proj) {
      Object.assign(proj, fields);
    }
    setDb(prev => ({ ...prev, projects: updatedProjects }));
    syncProject(proj);
  };

  // Load baseline loading view
  if (loading || !db) {
    return (
      <div className="auth-overlay" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="spinner" style={{ borderTopColor: '#0d9488' }}></div>
        <h2 style={{ fontSize: '18px', color: '#0f172a' }}>Loading Curriculum Cockpit...</h2>
      </div>
    );
  }

  // Auth Portal Page Render
  if (!currentUser) {
    return (
      <div className="auth-overlay" style={{ display: 'flex' }}>
        <div className="auth-container">
          <div className="auth-header">
            <h2>💻 DE Mastery Tracker</h2>
            <p>{authMode === 'login' ? 'Enter credentials to load database session' : 'Create a new account on Neon Cloud'}</p>
          </div>

          <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {authMode === 'signup' && (
              <div className="workspace-section">
                <label className="workspace-label">Full Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={signupForm.name}
                  onChange={e => setSignupForm({ ...signupForm, name: e.target.value })}
                  placeholder="Enter your name"
                />
              </div>
            )}

            <div className="workspace-section">
              <label className="workspace-label">Email Address</label>
              <input
                type="email"
                className="input-field"
                value={authMode === 'login' ? loginForm.email : signupForm.email}
                onChange={e => authMode === 'login'
                  ? setLoginForm({ ...loginForm, email: e.target.value })
                  : setSignupForm({ ...signupForm, email: e.target.value })}
                placeholder="you@example.com"
              />
            </div>

            {authMode === 'signup' && (
              <div className="workspace-section">
                <label className="workspace-label">DE Target Goal</label>
                <input
                  type="text"
                  className="input-field"
                  value={signupForm.goal}
                  onChange={e => setSignupForm({ ...signupForm, goal: e.target.value })}
                  placeholder="e.g. Big Data Engineer"
                />
              </div>
            )}

            <div className="workspace-section">
              <label className="workspace-label">Security PIN (6565)</label>
              <input
                type="password"
                className="input-field"
                maxLength="6"
                value={authMode === 'login' ? loginForm.pin : signupForm.pin}
                onChange={e => authMode === 'login'
                  ? setLoginForm({ ...loginForm, pin: e.target.value })
                  : setSignupForm({ ...signupForm, pin: e.target.value })}
                placeholder="Enter 4-6 digit PIN"
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
              {authMode === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px' }}>
            {authMode === 'login' ? (
              <span>New student? <a href="#" style={{ color: '#0d9488', fontWeight: 600 }} onClick={() => setAuthMode('signup')}>Create Account</a></span>
            ) : (
              <span>Already registered? <a href="#" style={{ color: '#0d9488', fontWeight: 600 }} onClick={() => setAuthMode('login')}>Sign In</a></span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Filter QBank list based on inputs
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
    <div className="app-container">
      {/* Toast notifications container */}
      <div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {notifications.map(n => (
          <div key={n.id} style={{
            padding: '12px 20px',
            backgroundColor: n.type === 'success' ? '#10b981' : '#ef4444',
            color: '#fff',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            animation: 'slideIn 0.3s ease'
          }}>
            {n.message}
          </div>
        ))}
      </div>

      {/* ================= LEFT SIDEBAR ================= */}
      <aside className="sidebar">
        <div>
          <div className="brand-section">
            <h1 className="brand-title">💻 DE Mastery</h1>
            <div className="brand-subtitle">Curriculum Cockpit</div>
          </div>

          <nav className="nav-menu">
            <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
              <span>Dashboard</span>
            </div>
            <div className={`nav-item ${activeTab === 'calendar' ? 'active' : ''}`} onClick={() => setActiveTab('calendar')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>182-Day Calendar</span>
            </div>
            <div className={`nav-item ${activeTab === 'qbank' ? 'active' : ''}`} onClick={() => setActiveTab('qbank')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              <span>Question Banks</span>
            </div>
            <div className={`nav-item ${activeTab === 'projects' ? 'active' : ''}`} onClick={() => setActiveTab('projects')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              <span>Megaprojects</span>
            </div>
            <div className={`nav-item ${activeTab === 'cheatsheets' ? 'active' : ''}`} onClick={() => setActiveTab('cheatsheets')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span>Cheat Sheets</span>
            </div>
            <div className={`nav-item ${activeTab === 'admin' ? 'active' : ''}`} onClick={() => setActiveTab('admin')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span>Admin Cockpit</span>
            </div>
            <div className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              <span>Settings</span>
            </div>
          </nav>
        </div>

        {/* Sidebar Footer Profile widget */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#f0fdfa', color: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
              {db.user_profile.name[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 'bold', maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{db.user_profile.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Lvl {db.user_profile.level} Student</div>
            </div>
          </div>
          <button className="btn" style={{ fontSize: '11px', padding: '4px 8px', width: '100%' }} onClick={logout}>Sign Out</button>
        </div>
      </aside>

      {/* ================= MAIN CONTENT SPACE ================= */}
      <main className="main-content">
        <header className="main-header">
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800 }}>
              {activeTab === 'dashboard' && '📈 Student Dashboard'}
              {activeTab === 'calendar' && '📅 182-Day Curriculum Tracker'}
              {activeTab === 'qbank' && '💻 Coding & Concept Banks'}
              {activeTab === 'projects' && '🚀 Portfolio Megaprojects'}
              {activeTab === 'cheatsheets' && '📝 Developer Cheat Sheets'}
              {activeTab === 'admin' && '🛡️ Administrator Control Center'}
              {activeTab === 'settings' && '⚙️ Configuration & Settings'}
            </h2>
          </div>

          {/* Gamification Header Metrics */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--accent-indigo)' }}>
              <span>⚡ {db.user_profile.xp} XP</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#f59e0b' }}>
              <span>🔥 {db.user_profile.current_streak} Day Streak (Best: {db.user_profile.best_streak})</span>
            </div>
          </div>
        </header>

        {/* ================= VIEW 1: DASHBOARD ================= */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Overview Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div className="stat-card">
                <span className="stat-label">Level</span>
                <span className="stat-value" style={{ color: 'var(--accent-indigo)' }}>{db.user_profile.level}</span>
                <span className="stat-desc">Next level in {((db.user_profile.level) * 100) - db.user_profile.xp} XP</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Completed Days</span>
                <span className="stat-value">{db.calendar.filter(d => d.completed).length} / 182</span>
                <span className="stat-desc">{Math.round((db.calendar.filter(d => d.completed).length / 182) * 100)}% of curriculum finished</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Solved Problems</span>
                <span className="stat-value">
                  {getQuestionList('sql').filter(q => q.solved).length + getQuestionList('dsa').filter(q => q.solved).length}
                </span>
                <span className="stat-desc">SQL: {getQuestionList('sql').filter(q => q.solved).length} | DSA: {getQuestionList('dsa').filter(q => q.solved).length}</span>
              </div>
            </div>

            {/* Target Goal Panel */}
            <div className="schedule-browser" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}>🎯 Target Career Objective</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                <strong>Role:</strong> {db.user_profile.goal || 'Not specified (go to Settings)'}
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                <strong>Target Companies:</strong> {db.user_profile.target_companies.join(', ') || 'Not specified'}
              </p>
            </div>

            {/* Today's Agenda Panel */}
            <div className="schedule-browser" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '12px' }}>
                📅 Today's Agenda (Day {db.calendar.findIndex(d => !d.completed) + 1})
              </h3>
              {(() => {
                const todayIndex = db.calendar.findIndex(d => !d.completed);
                const today = todayIndex !== -1 ? db.calendar[todayIndex] : db.calendar[0];
                if (!today) return <span>Complete! All days finished.</span>;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent-indigo)' }}>
                      Topic: {today.topic}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <input
                          type="checkbox"
                          checked={today.morning_completed}
                          onChange={() => toggleCalendarTask(today.day_number, 'morning_completed')}
                        />
                        <span>🌅 Morning Task: {today.morning_task}</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <input
                          type="checkbox"
                          checked={today.afternoon_completed}
                          onChange={() => toggleCalendarTask(today.day_number, 'afternoon_completed')}
                        />
                        <span>☀️ Afternoon Task: {today.afternoon_task}</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <input
                          type="checkbox"
                          checked={today.evening_completed}
                          onChange={() => toggleCalendarTask(today.day_number, 'evening_completed')}
                        />
                        <span>🌙 Evening Task: {today.evening_task}</span>
                      </label>
                    </div>

                    <button className="btn btn-primary" onClick={() => setSelectedDay(today)} style={{ alignSelf: 'flex-start', marginTop: '4px' }}>
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
          <div className="days-grid">
            {db.calendar.map(day => (
              <div
                key={day.day_number}
                className={`day-card ${day.completed ? 'completed' : ''} ${day.penalized ? 'penalized' : ''}`}
                onClick={() => setSelectedDay(day)}
              >
                <span className="day-number">Day {day.day_number}</span>
                <span className="day-title" style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {day.topic}
                </span>
                <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                  <span style={{ fontSize: '8px', color: day.morning_completed ? 'var(--accent-indigo)' : '#cbd5e1' }}>🌅</span>
                  <span style={{ fontSize: '8px', color: day.afternoon_completed ? 'var(--accent-indigo)' : '#cbd5e1' }}>☀️</span>
                  <span style={{ fontSize: '8px', color: day.evening_completed ? 'var(--accent-indigo)' : '#cbd5e1' }}>🌙</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ================= VIEW 3: QUESTION BANKS ================= */}
        {activeTab === 'qbank' && (
          <div className="schedule-layout">
            
            {/* Left sidebar bank category picker */}
            <div className="schedule-sidebar">
              <div
                className={`schedule-sidebar-item ${activeQBankTab === 'sql' ? 'active' : ''}`}
                onClick={() => setActiveQBankTab('sql')}
              >
                💾 SQL Coding Questions
              </div>
              <div
                className={`schedule-sidebar-item ${activeQBankTab === 'dsa' ? 'active' : ''}`}
                onClick={() => setActiveQBankTab('dsa')}
              >
                🧩 DSA Algorithms
              </div>
              <div
                className={`schedule-sidebar-item ${activeQBankTab === 'pyspark' ? 'active' : ''}`}
                onClick={() => setActiveQBankTab('pyspark')}
              >
                📊 PySpark Big Data
              </div>
              <div
                className={`schedule-sidebar-item ${activeQBankTab === 'concepts' ? 'active' : ''}`}
                onClick={() => setActiveQBankTab('concepts')}
              >
                📚 Core DE Concepts
              </div>
              <div
                className={`schedule-sidebar-item ${activeQBankTab === 'interview' ? 'active' : ''}`}
                onClick={() => setActiveQBankTab('interview')}
              >
                🎙️ Scenario Interviews
              </div>
            </div>

            {/* Right side QBank list pane */}
            <div className="schedule-browser">
              {/* Search and Filters row */}
              <div className="qbank-filters">
                <input
                  type="text"
                  placeholder="Search questions or patterns..."
                  className="input-field"
                  style={{ flex: 2 }}
                  value={qbankFilters.search}
                  onChange={e => setQbankFilters({ ...qbankFilters, search: e.target.value })}
                />
                
                <select
                  className="input-field"
                  value={qbankFilters.difficulty}
                  onChange={e => setQbankFilters({ ...qbankFilters, difficulty: e.target.value })}
                >
                  <option value="">All Difficulties</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>

                <select
                  className="input-field"
                  value={qbankFilters.status}
                  onChange={e => setQbankFilters({ ...qbankFilters, status: e.target.value })}
                >
                  <option value="">All Statuses</option>
                  <option value="solved">Solved</option>
                  <option value="unsolved">Unsolved</option>
                </select>
              </div>

              {/* Data Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '10px' }}>ID</th>
                    <th style={{ padding: '10px' }}>Problem</th>
                    <th style={{ padding: '10px' }}>Category</th>
                    {activeQBankTab === 'sql' && <th style={{ padding: '10px' }}>Topic</th>}
                    {activeQBankTab === 'dsa' && <th style={{ padding: '10px' }}>Pattern</th>}
                    {(activeQBankTab === 'sql' || activeQBankTab === 'dsa') && <th style={{ padding: '10px' }}>Difficulty</th>}
                    <th style={{ padding: '10px' }}>Status</th>
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
                      style={{ cursor: 'pointer', borderBottom: '1px solid var(--border-color)', fontSize: '13px' }}
                      className="qrow"
                    >
                      <td style={{ padding: '12px 10px' }}>#{item.id}</td>
                      <td style={{ padding: '12px 10px', fontWeight: 'bold' }}>{item.question || item.title}</td>
                      <td style={{ padding: '12px 10px' }}>{item.category}</td>
                      {activeQBankTab === 'sql' && <td style={{ padding: '12px 10px' }}><code>{item.topic}</code></td>}
                      {activeQBankTab === 'dsa' && <td style={{ padding: '12px 10px' }}>{item.pattern}</td>}
                      {(activeQBankTab === 'sql' || activeQBankTab === 'dsa') && (
                        <td style={{ padding: '12px 10px' }}>
                          <span className={`difficulty-label ${(item.difficulty || '').toLowerCase()}`}>
                            {item.difficulty}
                          </span>
                        </td>
                      )}
                      <td style={{ padding: '12px 10px' }}>
                        {item.solved ? (
                          <span className="badge badge-success">✓ Solved</span>
                        ) : (
                          <span className="badge badge-gray">Unsolved</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredQBankList.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-tertiary)' }}>
                        No questions match the active search or filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

            </div>
          </div>
        )}

        {/* ================= VIEW 4: MEGAPROJECTS ================= */}
        {activeTab === 'projects' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {db.projects.map(proj => (
              <div key={`${proj.name}-${proj.week}`} className="schedule-browser" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--accent-indigo)', textTransform: 'uppercase' }}>
                      Month {Math.ceil(proj.week / 4)} | Week {proj.week}
                    </span>
                    <h3 style={{ fontSize: '16px', fontWeight: 800 }}>{proj.name}</h3>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={proj.completed || false}
                      onChange={e => toggleProject(proj.name, proj.week, e.target.checked)}
                    />
                    <span>Mark Completed</span>
                  </label>
                </div>

                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{proj.description}</p>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '8px' }}>
                  <div className="workspace-section">
                    <label className="workspace-label">GitHub Repository URL</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="https://github.com/username/project"
                      value={proj.github_url || ''}
                      onChange={e => updateProjectFields(proj.name, proj.week, { github_url: e.target.value })}
                    />
                  </div>
                  <div className="workspace-section">
                    <label className="workspace-label">Duration (Hours Spent)</label>
                    <input
                      type="number"
                      className="input-field"
                      min="0"
                      value={proj.time_spent_hours || 0}
                      onChange={e => updateProjectFields(proj.name, proj.week, { time_spent_hours: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="workspace-section">
                  <label className="workspace-label">Development Notes & Architecture doubts</label>
                  <textarea
                    className="input-field"
                    style={{ minHeight: '60px', fontFamily: 'inherit' }}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {Object.keys(db.cheat_sheets).map(key => {
              const sheet = db.cheat_sheets[key];
              return (
                <div key={key} className="schedule-browser" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px', color: 'var(--accent-indigo)' }}>
                    📝 {sheet.title} Syntax Checklist
                  </h3>
                  <textarea
                    className="input-field"
                    style={{ minHeight: '200px', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.6' }}
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
              <div className="schedule-browser" style={{ padding: '40px', maxWidth: '400px', margin: '40px auto', textAlign: 'center' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>🛡️ Admin Gateway</h3>
                <form onSubmit={handleAdminVerify} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input
                    type="password"
                    placeholder="Enter Admin PIN"
                    className="input-field"
                    value={adminPinInput}
                    onChange={e => setAdminPinInput(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary">Verify Access</button>
                </form>
              </div>
            ) : (
              <div className="schedule-layout">
                {/* Admin user sidebar directory */}
                <div className="schedule-sidebar" style={{ width: '300px' }}>
                  <input
                    type="text"
                    placeholder="Search users..."
                    className="input-field"
                    style={{ marginBottom: '12px' }}
                    value={adminSearch}
                    onChange={e => setAdminSearch(e.target.value)}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '400px' }}>
                    {adminUsers
                      .filter(u => u.name.toLowerCase().includes(adminSearch.toLowerCase()) || u.email.toLowerCase().includes(adminSearch.toLowerCase()))
                      .map(u => (
                        <div
                          key={u.id}
                          className={`schedule-sidebar-item ${adminSelectedUser?.id === u.id ? 'active' : ''}`}
                          onClick={() => selectUserAdminInspect(u)}
                          style={{ padding: '10px', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                          <div>
                            <div style={{ fontWeight: 'bold' }}>{u.name}</div>
                            <div style={{ fontSize: '10px', opacity: 0.8 }}>{u.email}</div>
                          </div>
                          <button
                            className="btn btn-danger"
                            style={{ padding: '2px 6px', fontSize: '10px' }}
                            onClick={e => {
                              e.stopPropagation();
                              deleteUserAccount(u.id, u.name);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Admin user detail pane */}
                <div className="schedule-browser">
                  {adminSelectedUser ? (
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 800, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                        👤 Inspecting Student: {adminSelectedUser.name}
                      </h3>
                      
                      <div className="qbank-filters" style={{ margin: '12px 0' }}>
                        <button className={`btn ${adminInspectTab === 'overview' ? 'btn-primary' : ''}`} onClick={() => setAdminInspectTab('overview')}>Overview</button>
                        <button className={`btn ${adminInspectTab === 'calendar' ? 'btn-primary' : ''}`} onClick={() => setAdminInspectTab('calendar')}>Calendar Grid</button>
                        <button className={`btn ${adminInspectTab === 'code' ? 'btn-primary' : ''}`} onClick={() => setAdminInspectTab('code')}>Code Editor Inspector</button>
                      </div>

                      {/* Admin Tab 1: Overview stats */}
                      {adminInspectTab === 'overview' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <div className="stat-card">
                            <span className="stat-label">Level / XP</span>
                            <span className="stat-value">Lvl {adminSelectedUser.level}</span>
                            <span className="stat-desc">{adminSelectedUser.xp} total XP accumulated</span>
                          </div>
                          <div className="stat-card">
                            <span className="stat-label">Streaks</span>
                            <span className="stat-value">{adminSelectedUser.current_streak} days</span>
                            <span className="stat-desc">Best streak: {adminSelectedUser.best_streak} days</span>
                          </div>
                        </div>
                      )}

                      {/* Admin Tab 2: Calendar tracker */}
                      {adminInspectTab === 'calendar' && adminSelectedUserProgress && (
                        <div>
                          <div className="days-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(45px, 1fr))' }}>
                            {adminSelectedUserProgress.calendar.map(day => (
                              <div
                                key={day.day_number}
                                onClick={() => setAdminInspectDay(day)}
                                style={{
                                  padding: '8px 4px',
                                  fontSize: '10px',
                                  textAlign: 'center',
                                  backgroundColor: day.completed ? 'var(--accent-success-light)' : (day.penalized ? 'var(--accent-danger-light)' : '#f1f5f9'),
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  border: adminInspectDay?.day_number === day.day_number ? '2px solid var(--accent-indigo)' : 'none'
                                }}
                              >
                                D{day.day_number}
                              </div>
                            ))}
                          </div>

                          {adminInspectDay && (
                            <div className="schedule-browser" style={{ marginTop: '16px', padding: '12px' }}>
                              <h4>Day {adminInspectDay.day_number} Details</h4>
                              <p><strong>Topic:</strong> {adminInspectDay.topic}</p>
                              <p><strong>Study Duration:</strong> {adminInspectDay.time_spent_minutes} minutes</p>
                              <p><strong>Reflections / Notes:</strong> {adminInspectDay.notes || 'No reflections written'}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Admin Tab 3: Code solutions */}
                      {adminInspectTab === 'code' && adminSelectedUserProgress && (
                        <div style={{ display: 'flex', gap: '16px' }}>
                          <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <select className="input-field" value={adminInspectCategory} onChange={e => setAdminInspectCategory(e.target.value)}>
                              <option value="sql">SQL Coding</option>
                              <option value="dsa">DSA Algorithmic</option>
                              <option value="pyspark">PySpark</option>
                            </select>

                            <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {adminSelectedUserProgress[`${adminInspectCategory === 'sql' ? 'sql_question_bank' : (adminInspectCategory === 'dsa' ? 'dsa_problems' : 'pyspark_questions')}`]
                                .filter(q => q.solved)
                                .map(q => (
                                  <div
                                    key={q.id}
                                    onClick={() => setAdminInspectQId(q.id)}
                                    className={`schedule-sidebar-item ${adminInspectQId === q.id ? 'active' : ''}`}
                                    style={{ fontSize: '11px', padding: '6px' }}
                                  >
                                    #{q.id} {q.question || q.title}
                                  </div>
                                ))}
                            </div>
                          </div>

                          <div style={{ flex: 1 }}>
                            {(() => {
                              const qList = adminSelectedUserProgress[`${adminInspectCategory === 'sql' ? 'sql_question_bank' : (adminInspectCategory === 'dsa' ? 'dsa_problems' : 'pyspark_questions')}`];
                              const q = qList.find(item => item.id === adminInspectQId);
                              if (!q) return <span style={{ color: 'var(--text-tertiary)' }}>Select a solved question to inspect code.</span>;

                              return (
                                <div>
                                  <h4 style={{ fontSize: '13px', fontWeight: 'bold' }}>{q.question || q.title}</h4>
                                  <pre style={{ backgroundColor: '#0f172a', color: '#e2e8f0', padding: '12px', borderRadius: '8px', fontSize: '12px', fontFamily: 'monospace', overflowX: 'auto', marginTop: '8px' }}>
                                    <code>{q.solution_code || 'No solution code submitted.'}</code>
                                  </pre>
                                  <div style={{ marginTop: '8px', fontSize: '12px' }}>
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
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
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
          <div className="schedule-layout" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="schedule-browser" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '12px' }}>
                👤 Edit Student Profile
              </h3>
              
              <div className="workspace-section">
                <label className="workspace-label">Full Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={db.user_profile.name}
                  onChange={e => {
                    const profile = { ...db.user_profile, name: e.target.value };
                    setDb(prev => ({ ...prev, user_profile: profile }));
                    syncProfile(profile);
                  }}
                />
              </div>

              <div className="workspace-section">
                <label className="workspace-label">Email Address</label>
                <input
                  type="email"
                  className="input-field"
                  value={db.user_profile.email}
                  disabled
                  style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }}
                />
              </div>

              <div className="workspace-section">
                <label className="workspace-label">Career Target Goal</label>
                <input
                  type="text"
                  className="input-field"
                  value={db.user_profile.goal}
                  onChange={e => {
                    const profile = { ...db.user_profile, goal: e.target.value };
                    setDb(prev => ({ ...prev, user_profile: profile }));
                    syncProfile(profile);
                  }}
                />
              </div>

              <div className="workspace-section">
                <label className="workspace-label">Target Companies (Comma separated)</label>
                <input
                  type="text"
                  className="input-field"
                  value={db.user_profile.target_companies.join(', ')}
                  onChange={e => {
                    const profile = { ...db.user_profile, target_companies: e.target.value.split(',').map(s => s.trim()).filter(Boolean) };
                    setDb(prev => ({ ...prev, user_profile: profile }));
                    syncProfile(profile);
                  }}
                />
              </div>

              <div className="workspace-section">
                <label className="workspace-label">Daily Study Target (Hours)</label>
                <input
                  type="number"
                  className="input-field"
                  min="1"
                  max="24"
                  value={db.user_profile.daily_study_hours}
                  onChange={e => {
                    const profile = { ...db.user_profile, daily_study_hours: parseInt(e.target.value) || 5 };
                    setDb(prev => ({ ...prev, user_profile: profile }));
                    syncProfile(profile);
                  }}
                />
              </div>

              <div className="workspace-section" style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '16px', marginTop: '12px' }}>
                <label className="workspace-label" style={{ color: 'var(--accent-indigo)' }}>🤖 Gemini API Key</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Paste your Gemini key here"
                  value={db.user_profile.gemini_api_key}
                  onChange={e => {
                    const profile = { ...db.user_profile, gemini_api_key: e.target.value };
                    setDb(prev => ({ ...prev, user_profile: profile }));
                    syncProfile(profile);
                  }}
                />
                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Needed for AI Coach reviewing, grading code, and custom doubts.</span>
              </div>

              <div className="workspace-section" style={{ marginTop: '12px' }}>
                <label className="workspace-label" style={{ color: '#0f766e' }}>🔗 Deployed Backend API URL</label>
                <input
                  type="text"
                  className="input-field"
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
                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Leave blank for local environment. Reloads application on change.</span>
              </div>
            </div>

            <div className="schedule-browser" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '12px' }}>
                ⚙️ Reset Tracker State
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                If you wish to wipe all check-ins, custom notes, syntax sheets, streaks, levels, and solutions to start completely fresh from Day 1, execute this reset trigger.
              </p>
              <button className="btn btn-danger" onClick={handleResetDatabase}>Wipe & Reset Database Progress</button>
            </div>
          </div>
        )}
      </main>

      {/* ================= MODAL 1: CALENDAR DAY DETAIL MODAL ================= */}
      {selectedDay && (
        <div className="workspace-modal-overlay" style={{ display: 'flex' }} onClick={() => setSelectedDay(null)}>
          <div className="workspace-modal-container" style={{ maxWidth: '550px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800 }}>📅 Day {selectedDay.day_number} Detail Config</h3>
              <button style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }} onClick={() => setSelectedDay(null)}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              <div>
                <strong>Curriculum Topic:</strong> <span style={{ color: 'var(--accent-indigo)' }}>{selectedDay.topic}</span>
              </div>

              {/* Task list quick display */}
              <div style={{ padding: '10px', backgroundColor: 'var(--bg-app)', borderRadius: '8px', fontSize: '12px' }}>
                <div>🌅 <strong>Morning:</strong> {selectedDay.morning_task}</div>
                <div style={{ margin: '4px 0' }}>☀️ <strong>Afternoon:</strong> {selectedDay.afternoon_task}</div>
                <div>🌙 <strong>Evening:</strong> {selectedDay.evening_task}</div>
              </div>

              <div className="workspace-section">
                <label className="workspace-label">Study Duration Gained (Minutes)</label>
                <input
                  type="number"
                  className="input-field"
                  min="0"
                  value={selectedDay.time_spent_minutes}
                  onChange={e => setSelectedDay({ ...selectedDay, time_spent_minutes: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="workspace-section">
                <label className="workspace-label">Confidence Rating (1-5)</label>
                <select
                  className="input-field"
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

              <div className="workspace-section">
                <label className="workspace-label">Daily reflections, notes or logical doubts</label>
                <textarea
                  className="input-field"
                  style={{ minHeight: '120px' }}
                  value={selectedDay.notes}
                  placeholder="What did you learn today? Edge cases? Notes on Spark jobs?"
                  onChange={e => setSelectedDay({ ...selectedDay, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button className="btn" onClick={() => setSelectedDay(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={saveDayDetails}>Save Details</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: QUESTION BANK WORKSPACE MODAL ================= */}
      {selectedQuestion && (
        <div className="workspace-modal-overlay" style={{ display: 'flex' }} onClick={() => setSelectedQuestion(null)}>
          <div className="workspace-modal-container" onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div>
                <span className={`badge difficulty-label ${(selectedQuestion.difficulty || '').toLowerCase()}`}>
                  {selectedQuestion.difficulty || 'Concept'}
                </span>
                <h3 style={{ fontSize: '16px', fontWeight: 800, marginTop: '4px' }}>
                  #{selectedQuestion.id} {selectedQuestion.question || selectedQuestion.title}
                </h3>
              </div>
              <button style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }} onClick={() => setSelectedQuestion(null)}>✕</button>
            </div>

            {/* Split Pane Details layout */}
            <div className="workspace-details-layout" style={{ marginTop: '16px' }}>
              
              {/* Left pane: Question statement */}
              <div className="workspace-question-pane">
                <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Description</h4>
                <div style={{ fontSize: '13px', lineHeight: '1.6', marginTop: '6px' }}>
                  {selectedQuestion.description || selectedQuestion.question || "Core Data Engineering learning item. Write down your solution notes."}
                </div>

                {selectedQuestion.de_relevance && (
                  <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#f0fdfa', borderRadius: '8px', borderLeft: '3px solid #0d9488' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#0f766e', textTransform: 'uppercase' }}>DE Relevance</span>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{selectedQuestion.de_relevance}</p>
                  </div>
                )}
              </div>

              {/* Right pane: Tabbed Workspace */}
              <div className="workspace-editor-pane">
                <div className="qbank-filters" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <button className={`btn ${workspaceTab === 'code' ? 'btn-primary' : ''}`} onClick={() => setWorkspaceTab('code')}>💻 Code Editor</button>
                  <button className={`btn ${workspaceTab === 'notes' ? 'btn-primary' : ''}`} onClick={() => setWorkspaceTab('notes')}>📝 Notes & Doubts</button>
                  <button className={`btn ${workspaceTab === 'coach' ? 'btn-primary' : ''}`} onClick={() => setWorkspaceTab('coach')}>🤖 AI Coach</button>
                </div>

                {/* Subtab 1: Code editor */}
                {workspaceTab === 'code' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', marginTop: '12px' }}>
                    <textarea
                      className="input-field"
                      style={{
                        flex: 1,
                        minHeight: '280px',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        backgroundColor: '#0f172a',
                        color: '#e2e8f0',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '12px',
                        lineHeight: '1.5'
                      }}
                      value={workspaceCode}
                      onChange={e => setWorkspaceCode(e.target.value)}
                      placeholder={selectedQuestionCategory === 'sql' ? "-- Write your SQL query solution here..." : "# Write your Python/PySpark solution here..."}
                    />

                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                        <input
                          type="checkbox"
                          checked={selectedQuestion.solved || false}
                          onChange={e => handleSolveQuestion(e.target.checked)}
                        />
                        <span>Mark as Solved</span>
                      </label>
                      <button className="btn btn-primary" onClick={() => handleSolveQuestion(true)}>Save Solution Code</button>
                    </div>
                  </div>
                )}

                {/* Subtab 2: Notes & doubts */}
                {workspaceTab === 'notes' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', marginTop: '12px' }}>
                    <textarea
                      className="input-field"
                      style={{ flex: 1, minHeight: '280px', fontFamily: 'inherit', fontSize: '13px' }}
                      value={workspaceNotes}
                      onChange={e => setWorkspaceNotes(e.target.value)}
                      placeholder="Write your study notes, doubts, edge cases or alternative approaches..."
                    />
                    <button className="btn btn-primary" style={{ alignSelf: 'flex-end' }} onClick={() => handleSolveQuestion(selectedQuestion.solved)}>Save Notes</button>
                  </div>
                )}

                {/* Subtab 3: Upgraded AI Coach */}
                {workspaceTab === 'coach' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                    <div className="qbank-filters" style={{ justifyContent: 'flex-start', borderBottom: '1px dashed var(--border-color)', paddingBottom: '6px' }}>
                      <button className={`btn ${aiSubTab === 'schema' ? 'btn-primary' : ''}`} style={{ fontSize: '11px', padding: '4px 8px' }} onClick={() => setAiSubTab('schema')}>📊 Mock Tables & Schemas</button>
                      <button className={`btn ${aiSubTab === 'hint' ? 'btn-primary' : ''}`} style={{ fontSize: '11px', padding: '4px 8px' }} onClick={() => setAiSubTab('hint')}>💡 Grade My Solution</button>
                      <button className={`btn ${aiSubTab === 'chat' ? 'btn-primary' : ''}`} style={{ fontSize: '11px', padding: '4px 8px' }} onClick={() => setAiSubTab('chat')}>💬 Doubt Chat</button>
                    </div>

                    <div style={{
                      minHeight: '220px',
                      maxHeight: '300px',
                      overflowY: 'auto',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '12px',
                      backgroundColor: '#fafafa',
                      fontSize: '12px',
                      lineHeight: '1.6'
                    }}>
                      
                      {aiLoading && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', paddingTop: '40px' }}>
                          <div className="spinner"></div>
                          <span>Coach is thinking...</span>
                        </div>
                      )}

                      {aiError && (
                        <span style={{ color: 'var(--accent-danger)', fontWeight: 'bold' }}>❌ Error: {aiError}</span>
                      )}

                      {!aiLoading && !aiError && (
                        <>
                          {/* Schema tab */}
                          {aiSubTab === 'schema' && (
                            selectedQuestion.ai_schema_context ? (
                              <div dangerouslySetInnerHTML={{ __html: parseMarkdown(selectedQuestion.ai_schema_context) }}></div>
                            ) : (
                              <div style={{ textAlign: 'center', padding: '30px 10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <span>No table context generated yet.</span>
                                <button className="btn btn-primary" style={{ alignSelf: 'center' }} onClick={generateSchemaMockTables}>🤖 Model Schema & Tables</button>
                              </div>
                            )
                          )}

                          {/* Grade Solution tab */}
                          {aiSubTab === 'hint' && (
                            selectedQuestion.ai_code_review_hint ? (
                              <div dangerouslySetInnerHTML={{ __html: parseMarkdown(selectedQuestion.ai_code_review_hint) }}></div>
                            ) : (
                              <div style={{ textAlign: 'center', padding: '30px 10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <span>Write some code in the editor, and click below to evaluate.</span>
                                <button className="btn btn-primary" style={{ alignSelf: 'center' }} onClick={evaluateAndRateSolution}>🤖 Grade & Review Code</button>
                              </div>
                            )
                          )}

                          {/* Chat tab */}
                          {aiSubTab === 'chat' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {(selectedQuestion.ai_chat_history || []).length === 0 ? (
                                <div className="ai-bubble coach" style={{ padding: '8px', backgroundColor: '#f0fdfa', borderLeft: '3px solid #0d9488', borderRadius: '4px' }}>
                                  👋 I am your AI Coach! Ask me any doubts about <strong>{selectedQuestion.question || selectedQuestion.title}</strong>, and I will guide you to find the solution.
                                </div>
                              ) : (
                                (selectedQuestion.ai_chat_history || []).map((msg, i) => (
                                  <div key={i} className={`ai-bubble ${msg.role}`} style={{
                                    padding: '8px',
                                    borderRadius: '6px',
                                    backgroundColor: msg.role === 'coach' ? '#f0fdfa' : '#f1f5f9',
                                    borderLeft: msg.role === 'coach' ? '3px solid #0d9488' : 'none'
                                  }}>
                                    <strong>{msg.role === 'coach' ? '🤖 Coach' : '👤 You'}:</strong>
                                    <div dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.text) }} style={{ marginTop: '4px' }}></div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Chat doubt query box */}
                    {aiSubTab === 'chat' && (
                      <form onSubmit={sendAICustomDoubt} style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Type your doubts (e.g. why do we need CTE here?)..."
                          value={aiChatQuery}
                          onChange={e => setAiChatQuery(e.target.value)}
                        />
                        <button type="submit" className="btn btn-primary">Ask</button>
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
