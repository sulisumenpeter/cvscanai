// AI Feature Generators: Interview, Cover Letter, JD Matcher
// These communicate with the independent Serverless APIs.

async function callGeneratorAPI(endpoint, promptType) {
  const jdText = document.getElementById('jd-text')?.value;
  const cvText = typeof cvTextContent !== 'undefined' ? cvTextContent : "";

  if (!cvText || !jdText) {
    alert("Please provide both CV and Job Description in the main analyzer tab first.");
    return null;
  }
  
  showToast(`Generating ${promptType}...`);
  
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cv: cvText, jd: jdText })
    });
    
    // Check res.ok before parsing JSON (Protects against Vercel 500 HTML errors)
    if (!res.ok) {
      let errText = "Unknown Server Error";
      try {
        const errJson = await res.json();
        errText = errJson.error || errText;
      } catch (e) {
        errText = `HTTP Error ${res.status}: API did not return JSON.`;
      }
      throw new Error(errText);
    }
    
    const data = await res.json();
    showToast(`✅ ${promptType} Generated!`);
    return data;
  } catch (err) {
    alert(`Generation failed: ${err.message}`);
    return null;
  }
}

// --- Specific Generator Wrappers ---

async function generateCoverLetter() {
  const btn = document.getElementById('btn-generate-cl');
  const resultBox = document.getElementById('cl-result');
  
  btn.disabled = true;
  btn.innerText = "Generating...";
  
  const data = await callGeneratorAPI('/api/coverletter', 'Cover Letter');
  
  if (data && data.cover_letter) {
    resultBox.classList.remove('hidden');
    resultBox.innerText = data.cover_letter;
  }
  
  btn.disabled = false;
  btn.innerText = "Generate Cover Letter";
}

async function generateInterviewQs() {
  const btn = document.getElementById('btn-generate-iq');
  const resultBox = document.getElementById('iq-result');
  
  btn.disabled = true;
  btn.innerText = "Generating...";
  
  const data = await callGeneratorAPI('/api/interview', 'Interview Questions');
  
  if (data) {
    resultBox.classList.remove('hidden');
    let html = '';
    if (data.technical) html += `<h4 class="font-bold text-gray-900 dark:text-white mt-4">Technical</h4><ul class="list-disc pl-5 text-gray-700 dark:text-gray-300">` + data.technical.map(q => `<li>${q}</li>`).join('') + `</ul>`;
    if (data.behavioral) html += `<h4 class="font-bold text-gray-900 dark:text-white mt-4">Behavioral</h4><ul class="list-disc pl-5 text-gray-700 dark:text-gray-300">` + data.behavioral.map(q => `<li>${q}</li>`).join('') + `</ul>`;
    if (data.role_specific) html += `<h4 class="font-bold text-gray-900 dark:text-white mt-4">Role-Specific</h4><ul class="list-disc pl-5 text-gray-700 dark:text-gray-300">` + data.role_specific.map(q => `<li>${q}</li>`).join('') + `</ul>`;
    resultBox.innerHTML = html;
  }
  
  btn.disabled = false;
  btn.innerText = "Generate Interview Questions";
}

async function generateJDMatch() {
  const btn = document.getElementById('btn-generate-jd');
  const resultBox = document.getElementById('jd-result');
  
  btn.disabled = true;
  btn.innerText = "Analyzing...";
  
  const data = await callGeneratorAPI('/api/matcher', 'JD Match');
  
  if (data) {
    resultBox.classList.remove('hidden');
    resultBox.innerHTML = `
      <div class="mb-4"><span class="font-bold text-xl text-indigo-600">Match Percentage: ${data.match_percentage}%</span></div>
      <h4 class="font-bold text-gray-900 dark:text-white mt-2">Matching Skills</h4>
      <p class="text-gray-700 dark:text-gray-300">${(data.matching_skills || []).join(', ')}</p>
      <h4 class="font-bold text-gray-900 dark:text-white mt-4">Missing Skills</h4>
      <p class="text-gray-700 dark:text-gray-300">${(data.missing_skills || []).join(', ')}</p>
      <h4 class="font-bold text-gray-900 dark:text-white mt-4">Relevant Experience</h4>
      <p class="text-gray-700 dark:text-gray-300">${data.relevant_experience}</p>
      <h4 class="font-bold text-gray-900 dark:text-white mt-4">Areas to Strengthen</h4>
      <p class="text-gray-700 dark:text-gray-300">${data.areas_to_strengthen}</p>
    `;
  }
  
  btn.disabled = false;
  btn.innerText = "Generate Match Analysis";
}
