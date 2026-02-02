// Конфигурация Supabase (ЗАМЕНИ НА СВОЙ!)
const SUPABASE_URL = 'https://FGT-KuYQawwuAVqD7tHAzQ.supabase.co';
const SUPABASE_KEY = 'sb_publishable_FGT-KuYQawwuAVqD7tHAzQ_aV1Ay_xF';

// Инициализация Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Состояние
let currentTrackId = null;
let audioContext = null;
let analyser = null;
let source = null;
let animationId = null;
let isVisualizing = false;
let currentUploadProgress = 0;

// DOM элементы
const elements = {
    userInfo: document.getElementById('userInfo'),
    authButtons: document.getElementById('authButtons'),
    userEmail: document.getElementById('userEmail'),
    logoutBtn: document.getElementById('logoutBtn'),
    showLoginBtn: document.getElementById('showLoginBtn'),
    loginModal: document.getElementById('loginModal'),
    emailInput: document.getElementById('emailInput'),
    passwordInput: document.getElementById('passwordInput'),
    loginBtn: document.getElementById('loginBtn'),
    signupBtn: document.getElementById('signupBtn'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    uploadBtn: document.getElementById('uploadBtn'),
    fileInput: document.getElementById('fileInput'),
    progressBar: document.getElementById('progressBar'),
    fileInfo: document.getElementById('fileInfo'),
    renameBox: document.getElementById('renameBox'),
    renameInput: document.getElementById('renameInput'),
    saveNameBtn: document.getElementById('saveNameBtn'),
    cancelRenameBtn: document.getElementById('cancelRenameBtn'),
    tracksContainer: document.getElementById('tracksContainer'),
    searchInput: document.getElementById('searchInput'),
    audioPlayer: document.getElementById('audioPlayer'),
    nowPlayingName: document.getElementById('nowPlayingName'),
    nowPlayingArtist: document.getElementById('nowPlayingArtist'),
    waveCanvas: document.getElementById('waveCanvas'),
    waveColor: document.getElementById('waveColor'),
    waveSpeed: document.getElementById('waveSpeed'),
    toggleVizBtn: document.getElementById('toggleVizBtn'),
    volumeSlider: document.getElementById('volumeSlider'),
    supabaseStatus: document.getElementById('supabaseStatus')
};

// Инициализация приложения
async function init() {
    console.log('Initializing NeoCascade Music...');
    
    // Проверяем сессию
    const { data: { session } } = await supabase.auth.getSession();
    updateAuthUI(session);
    
    // Слушаем изменения авторизации
    supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event);
        updateAuthUI(session);
        
        if (session && event === 'SIGNED_IN') {
            loadTracks();
        }
    });
    
    // Настройка Canvas
    setupCanvas();
    
    // Настройка обработчиков событий
    setupEventListeners();
    
    // Загрузка треков если авторизован
    if (session) {
        loadTracks();
    }
}

// Обновление UI авторизации
function updateAuthUI(session) {
    if (session) {
        elements.userEmail.textContent = session.user.email;
        elements.userInfo.style.display = 'flex';
        elements.authButtons.style.display = 'none';
        elements.supabaseStatus.textContent = 'Connected';
        elements.supabaseStatus.style.color = '#00ff88';
    } else {
        elements.userInfo.style.display = 'none';
        elements.authButtons.style.display = 'block';
        elements.supabaseStatus.textContent = 'Not authenticated';
        elements.supabaseStatus.style.color = '#ff3366';
        elements.tracksContainer.innerHTML = `
            <div class="track-item placeholder">
                <div class="track-icon">
                    <i class="fas fa-headphones"></i>
                </div>
                <div class="track-info">
                    <h3 class="track-name">Sign in to upload tracks</h3>
                    <p class="track-meta">Click "Sign In" button above</p>
                </div>
            </div>
        `;
    }
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Кнопки авторизации
    elements.showLoginBtn?.addEventListener('click', () => {
        elements.loginModal.style.display = 'flex';
    });
    
    elements.logoutBtn?.addEventListener('click', async () => {
        await supabase.auth.signOut();
    });
    
    elements.loginBtn?.addEventListener('click', handleLogin);
    elements.signupBtn?.addEventListener('click', handleSignup);
    elements.closeModalBtn?.addEventListener('click', () => {
        elements.loginModal.style.display = 'none';
    });
    
    // Загрузка файлов
    elements.uploadBtn?.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput?.addEventListener('change', handleFileUpload);
    
    // Переименование
    elements.saveNameBtn?.addEventListener('click', handleRename);
    elements.cancelRenameBtn?.addEventListener('click', () => {
        elements.renameBox.style.display = 'none';
        currentTrackId = null;
    });
    
    // Поиск
    elements.searchInput?.addEventListener('input', handleSearch);
    
    // Аудио плеер
    elements.audioPlayer?.addEventListener('play', handleAudioPlay);
    elements.audioPlayer?.addEventListener('ended', handleAudioEnded);
    
    // Визуализатор
    elements.toggleVizBtn?.addEventListener('click', toggleVisualization);
    elements.waveColor?.addEventListener('input', () => {
        if (isVisualizing) drawVisualizer();
    });
    
    // Громкость
    elements.volumeSlider?.addEventListener('input', (e) => {
        elements.audioPlayer.volume = e.target.value / 100;
    });
    
    // Resize окна
    window.addEventListener('resize', setupCanvas);
}

// Обработка логина
async function handleLogin() {
    const email = elements.emailInput.value;
    const password = elements.passwordInput.value;
    
    if (!email || !password) {
        alert('Please enter email and password');
        return;
    }
    
    const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });
    
    if (error) {
        alert('Login error: ' + error.message);
    } else {
        elements.loginModal.style.display = 'none';
        elements.emailInput.value = '';
        elements.passwordInput.value = '';
    }
}

// Обработка регистрации
async function handleSignup() {
    const email = elements.emailInput.value;
    const password = elements.passwordInput.value;
    
    if (!email || !password) {
        alert('Please enter email and password');
        return;
    }
    
    if (password.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }
    
    const { error } = await supabase.auth.signUp({
        email: email,
        password: password
    });
    
    if (error) {
        alert('Signup error: ' + error.message);
    } else {
        alert('Check your email for confirmation!');
        elements.loginModal.style.display = 'none';
    }
}

// Загрузка файла
async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('audio/')) {
        alert('Please select an audio file (MP3, WAV, etc.)');
        return;
    }
    
    if (file.size > 50 * 1024 * 1024) { // 50MB
        alert('File is too large (max 50MB)');
        return;
    }
    
    const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    
    // Сброс прогресса
    elements.progressBar.style.width = '0%';
    elements.fileInfo.textContent = 'Uploading...';
    elements.fileInfo.style.color = '#88ffcc';
    
    try {
        // Загрузка в Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('tracks')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false,
                onUploadProgress: (progress) => {
                    const percent = (progress.loaded / progress.total) * 100;
                    elements.progressBar.style.width = `${percent}%`;
                    elements.fileInfo.textContent = `Uploading: ${Math.round(percent)}%`;
                }
            });
        
        if (uploadError) throw uploadError;
        
        // Получение публичной ссылки
        const { data: { publicUrl } } = supabase.storage
            .from('tracks')
            .getPublicUrl(fileName);
        
        // Сохранение в базу данных
        const { data: trackData, error: dbError } = await supabase
            .from('tracks')
            .insert({
                name: file.name.replace(/\.[^/.]+$/, ""),
                original_name: file.name,
                file_path: fileName,
                url: publicUrl,
                size: file.size,
                type: file.type,
                plays: 0
            })
            .select()
            .single();
        
        if (dbError) throw dbError;
        
        // Успех
        elements.fileInfo.textContent = 'Upload complete!';
        elements.fileInfo.style.color = '#00ff88';
        elements.progressBar.style.width = '100%';
        
        // Показываем переименование
        currentTrackId = trackData.id;
        elements.renameInput.value = trackData.name;
        elements.renameBox.style.display = 'block';
        
        // Обновляем список
        loadTracks();
        
    } catch (error) {
        console.error('Upload error:', error);
        elements.fileInfo.textContent = 'Upload failed: ' + error.message;
        elements.fileInfo.style.color = '#ff3366';
        elements.progressBar.style.width = '0%';
    } finally {
        // Сброс input
        elements.fileInput.value = '';
    }
}

// Переименование трека
async function handleRename() {
    if (!currentTrackId || !elements.renameInput.value.trim()) return;
    
    const newName = elements.renameInput.value.trim();
    
    const { error } = await supabase
        .from('tracks')
        .update({ name: newName })
        .eq('id', currentTrackId);
    
    if (error) {
        alert('Error renaming track: ' + error.message);
    } else {
        elements.renameBox.style.display = 'none';
        currentTrackId = null;
        loadTracks();
    }
}

// Загрузка треков
async function loadTracks() {
    const { data: tracks, error } = await supabase
        .from('tracks')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Error loading tracks:', error);
        return;
    }
    
    renderTracks(tracks);
}

// Отображение треков
function renderTracks(tracks) {
    if (!tracks || tracks.length === 0) {
        elements.tracksContainer.innerHTML = `
            <div class="track-item placeholder">
                <div class="track-icon">
                    <i class="fas fa-headphones"></i>
                </div>
                <div class="track-info">
                    <h3 class="track-name">No tracks yet</h3>
                    <p class="track-meta">Upload your first track above!</p>
                </div>
            </div>
        `;
        return;
    }
    
    elements.tracksContainer.innerHTML = '';
    
    tracks.forEach(track => {
        const trackEl = createTrackElement(track);
        elements.tracksContainer.appendChild(trackEl);
    });
}

// Создание элемента трека
function createTrackElement(track) {
    const div = document.createElement('div');
    div.className = 'track-item';
    div.dataset.id = track.id;
    
    const sizeMB = (track.size / (1024 * 1024)).toFixed(2);
    const date = new Date(track.created_at).toLocaleDateString();
    
    div.innerHTML = `
        <div class="track-icon">
            <i class="fas fa-music"></i>
        </div>
        <div class="track-info">
            <h3 class="track-name">${track.name}</h3>
            <p class="track-meta">${sizeMB} MB • ${date} • ${track.plays || 0} plays</p>
        </div>
        <div class="track-actions">
            <button class="icon-btn play-btn" title="Play">
                <i class="fas fa-play"></i>
            </button>
            <button class="icon-btn rename-btn" title="Rename">
                <i class="fas fa-edit"></i>
            </button>
            <button class="icon-btn delete-btn" title="Delete">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    // Обработчики действий
    div.querySelector('.play-btn').addEventListener('click', () => playTrack(track));
    div.querySelector('.rename-btn').addEventListener('click', () => {
        currentTrackId = track.id;
        elements.renameInput.value = track.name;
        elements.renameBox.style.display = 'block';
    });
    div.querySelector('.delete-btn').addEventListener('click', () => deleteTrack(track));
    
    return div;
}

// Воспроизведение трека
function playTrack(track) {
    elements.audioPlayer.src = track.url;
    elements.audioPlayer.play();
    
    elements.nowPlayingName.textContent = track.name;
    elements.nowPlayingArtist.textContent = 'NeoCascade Music';
    
    // Обновляем счетчик прослушиваний
    updatePlayCount(track.id, track.plays || 0);
}

// Обновление счетчика прослушиваний
async function updatePlayCount(trackId, currentPlays) {
    const { error } = await supabase
        .from('tracks')
        .update({ plays: currentPlays + 1 })
        .eq('id', trackId);
    
    if (!error) {
        // Обновляем локально
        const trackEl = document.querySelector(`.track-item[data-id="${trackId}"]`);
        if (trackEl) {
            const metaEl = trackEl.querySelector('.track-meta');
            if (metaEl) {
                metaEl.textContent = metaEl.textContent.replace(
                    /\d+ plays/,
                    `${currentPlays + 1} plays`
                );
            }
        }
    }
}

// Удаление трека
async function deleteTrack(track) {
    if (!confirm('Delete this track forever?')) return;
    
    try {
        // Удаляем из Storage
        const { error: storageError } = await supabase.storage
            .from('tracks')
            .remove([track.file_path]);
        
        if (storageError) throw storageError;
        
        // Удаляем из базы данных
        const { error: dbError } = await supabase
            .from('tracks')
            .delete()
            .eq('id', track.id);
        
        if (dbError) throw dbError;
        
        // Обновляем список
        loadTracks();
        
    } catch (error) {
        alert('Error deleting track: ' + error.message);
    }
}

// Поиск треков
function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    const trackItems = document.querySelectorAll('.track-item');
    
    trackItems.forEach(item => {
        const trackName = item.querySelector('.track-name').textContent.toLowerCase();
        item.style.display = trackName.includes(searchTerm) ? 'flex' : 'none';
    });
}

// Настройка Canvas
function setupCanvas() {
    elements.waveCanvas.width = elements.waveCanvas.offsetWidth;
    elements.waveCanvas.height = elements.waveCanvas.offsetHeight;
}

// Обработка воспроизведения аудио
function handleAudioPlay() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        source = audioContext.createMediaElementSource(elements.audioPlayer);
        
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        analyser.fftSize = 256;
    }
    
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    if (!isVisualizing) {
        isVisualizing = true;
        elements.toggleVizBtn.innerHTML = '<i class="fas fa-pause"></i> Pause Visualization';
        drawVisualizer();
    }
}

// Обработка окончания трека
function handleAudioEnded() {
    elements.nowPlayingName.textContent = 'No track selected';
    elements.nowPlayingArtist.textContent = 'NeoCascade';
    elements.audioPlayer.src = '';
    
    // Останавливаем визуализацию
    if (isVisualizing) {
        cancelAnimationFrame(animationId);
        isVisualizing = false;
        elements.toggleVizBtn.innerHTML = '<i class="fas fa-play"></i> Play Visualization';
    }
}

// Визуализатор
function drawVisualizer() {
    if (!isVisualizing || !analyser) return;
    
    const canvasCtx = elements.waveCanvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const width = elements.waveCanvas.width;
    const height = elements.waveCanvas.height;
    const speed = parseInt(elements.waveSpeed.value);
    const color = elements.waveColor.value;
    
    animationId = requestAnimationFrame(drawVisualizer);
    analyser.getByteFrequencyData(dataArray);
    
    canvasCtx.clearRect(0, 0, width, height);
    
    // Рисуем волну
    canvasCtx.lineWidth = 3;
    canvasCtx.strokeStyle = color;
    canvasCtx.shadowBlur = 15;
    canvasCtx.shadowColor = color;
    canvasCtx.beginPath();
    
    const sliceWidth = width * 1.0 / bufferLength;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * height / 2;
        
        if (i === 0) {
            canvasCtx.moveTo(x, y);
        } else {
            canvasCtx.lineTo(x, y);
        }
        
        x += sliceWidth * speed / 3;
    }
    
    canvasCtx.lineTo(width, height / 2);
    canvasCtx.stroke();
    
    // Частицы
    for (let i = 0; i < bufferLength; i += 8) {
        const v = dataArray[i] / 128.0;
        const y = v * height / 2;
        const x = (i * sliceWidth * speed / 3) % width;
        
        canvasCtx.beginPath();
        canvasCtx.arc(x, y, 3, 0, Math.PI * 2);
        canvasCtx.fillStyle = color;
        canvasCtx.fill();
    }
}

// Переключение визуализации
function toggleVisualization() {
    isVisualizing = !isVisualizing;
    
    if (isVisualizing) {
        elements.toggleVizBtn.innerHTML = '<i class="fas fa-pause"></i> Pause Visualization';
        if (analyser) drawVisualizer();
    } else {
        elements.toggleVizBtn.innerHTML = '<i class="fas fa-play"></i> Play Visualization';
        cancelAnimationFrame(animationId);
    }
}

// Запуск при загрузке страницы
document.addEventListener('DOMContentLoaded', init);
