/* Vetogram Play Arcade 2 — self-contained games, no remote calls or account access. */
(() => {
  'use strict';
  const root = document.querySelector('.screen[data-screen="play"]');
  if (!root) return;
  const $ = id => root.querySelector(id);
  const haptic = () => { try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'); } catch {} };
  const read = key => { try { const value = Number(window.localStorage.getItem(key)); return Number.isFinite(value) && value >= 0 ? value : 0; } catch { return 0; } };
  const save = (key,value) => { try { window.localStorage.setItem(key,String(value)); } catch {} };
  const WIN_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const winner = cells => {
    for (const [a,b,c] of WIN_LINES) {
      if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) return cells[a];
    }
    return cells.every(Boolean) ? 'draw' : null;
  };
  const tttGrid = $('#vpTttGrid');
  const tttStatus = $('#vpTttStatus');
  const tttWins = $('#vpTttWins');
  const tttReset = $('#vpTttReset');
  const WINS_KEY = 'vetogram:play:tic-wins:v1';
  let tttBoard = Array(9).fill('');
  let tttDone = false;
  function minimax(board, botTurn, depth) {
    const end = winner(board);
    if (end) return { X:-10+depth, O:10-depth, draw:0 }[end];
    const moveChar = botTurn ? 'O' : 'X';
    let best = botTurn ? -Infinity : Infinity;
    for (let i = 0; i < board.length; i++) {
      if (board[i]) continue;
      board[i] = moveChar;
      const score = minimax(board,!botTurn,depth+1);
      board[i] = '';
      best = botTurn ? Math.max(best,score) : Math.min(best,score);
    }
    return best;
  }
  function botMove() {
    let high = -Infinity, move = -1;
    const preferred = [4,0,2,6,8,1,3,5,7];
    for (const i of preferred) {
      if (tttBoard[i]) continue;
      tttBoard[i] = 'O';
      const score = minimax(tttBoard,false,0);
      tttBoard[i] = '';
      if (score > high) { high=score; move=i; }
    }
    if (move !== -1) tttBoard[move] = 'O';
  }
  function settleTtt() {
    const end = winner(tttBoard);
    if (!end) { tttStatus.textContent = 'Твой ход — X'; return; }
    tttDone = true;
    if (end === 'X') { save(WINS_KEY,read(WINS_KEY)+1); tttStatus.textContent='Победа! Ты обыграл бота.'; }
    else if (end === 'O') tttStatus.textContent='Бот победил. Попробуй ещё раз.';
    else tttStatus.textContent='Ничья. Попробуем реванш?';
    tttWins.textContent = 'Побед на устройстве: '+read(WINS_KEY);
  }
  function drawTtt() {
    if (!tttGrid) return;
    tttGrid.replaceChildren();
    tttBoard.forEach((symbol,i) => {
      const cell = document.createElement('button');
      cell.type='button'; cell.className='vp-ttt-cell';
      cell.textContent = symbol || '·';
      cell.dataset.mark = symbol || 'empty';
      cell.disabled = tttDone || Boolean(symbol);
      cell.setAttribute('aria-label', 'Поле '+(i+1)+(symbol?' — '+symbol:' — свободно'));
      cell.addEventListener('click', () => {
        if (tttDone || tttBoard[i]) return;
        tttBoard[i]='X'; haptic(); settleTtt();
        if (!tttDone) { botMove(); settleTtt(); }
        drawTtt();
      });
      tttGrid.appendChild(cell);
    });
  }
  function resetTtt() {
    tttBoard=Array(9).fill('');tttDone=false;
    if (tttStatus) tttStatus.textContent='Ты играешь крестиками (X). Начинай.';
    if (tttWins) tttWins.textContent='Побед на устройстве: '+read(WINS_KEY);
    drawTtt();
  }
  tttReset?.addEventListener('click', () => {haptic();resetTtt();});

  const puzzleGrid = $('#vp2048Grid');
  const puzzleScore = $('#vp2048Score');
  const puzzleBest = $('#vp2048Best');
  const puzzleStatus = $('#vp2048Status');
  const puzzleReset = $('#vp2048Reset');
  const PUZZLE_BEST = 'vetogram:play:2048-best:v1';
  let board = Array(16).fill(0);
  let points = 0;
  let finished = false;
  let achieved2048 = false;
  function spawn() {
    const empty=board.map((v,i)=>v?null:i).filter(v=>v!==null);
    if (!empty.length) return;
    const index=empty[Math.floor(Math.random()*empty.length)];
    board[index]=Math.random()<0.9?2:4;
  }
  function linesFor(dir) {
    const lines=[];
    for (let n=0;n<4;n++) {
      const line=[];
      for (let p=0;p<4;p++) {
        if (dir==='left') line.push(n*4+p);
        else if (dir==='right') line.push(n*4+3-p);
        else if (dir==='up') line.push(p*4+n);
        else line.push((3-p)*4+n);
      }
      lines.push(line);
    }
    return lines;
  }
  function collapse(line) {
    const values=line.filter(Boolean);
    let earned=0;
    const result=[];
    for(let i=0;i<values.length;i++){
      if(values[i]===values[i+1]) {
        const merged=values[i]*2;
        result.push(merged);
        earned+=merged;
        i++;
      } else result.push(values[i]);
    }
    while(result.length<4)result.push(0);
    return {result,earned};
  }
  function canMove() {
    if(board.includes(0)) return true;
    for (const dir of ['left','up']) {
      for (const line of linesFor(dir)) {
        const v=line.map(i=>board[i]);
        if(v.some((x,i)=>i>0&&x===v[i-1]))return true;
      }
    }
    return false;
  }
  function displayPuzzle() {
    if (!puzzleGrid) return;
    puzzleGrid.replaceChildren();
    board.forEach(value => {
      const tile=document.createElement('div');
      tile.className='vp-2048-tile';
      tile.dataset.value=String(value?Math.min(value,2048):0);
      tile.textContent=value?String(value):'';
      tile.setAttribute('aria-label',value?'Плитка '+value:'Пустая клетка');
      puzzleGrid.appendChild(tile);
    });
    if(puzzleScore)puzzleScore.textContent='Очки: '+points;
    if(puzzleBest)puzzleBest.textContent='Рекорд: '+Math.max(points,read(PUZZLE_BEST));
  }
  function movePuzzle(dir) {
    if(finished || !['up','down','left','right'].includes(dir))return false;
    let moved=false,earned=0;
    const copy=board.slice();
    for (const line of linesFor(dir)){
      const {result,earned:gain}=collapse(line.map(i=>board[i]));
      earned+=gain;
      result.forEach((v,j)=>{if(v!==copy[line[j]])moved=true;board[line[j]]=v;});
    }
    if(!moved)return false;
    points+=earned;
    if(points>read(PUZZLE_BEST))save(PUZZLE_BEST,points);
    if(!achieved2048&&board.some(v=>v>=2048)) {
      achieved2048=true;
      if(puzzleStatus)puzzleStatus.textContent='2048 достигнуто! Можно играть дальше.';
    }
    spawn();
    if(!canMove()){finished=true;if(puzzleStatus)puzzleStatus.textContent='Ходов больше нет — начни заново.';}
    else if(!achieved2048&&puzzleStatus)puzzleStatus.textContent='Соединяй одинаковые плитки.';
    displayPuzzle();haptic();return true;
  }
  function resetPuzzle() {
    board=Array(16).fill(0);points=0;finished=false;achieved2048=false;
    spawn();spawn();
    if(puzzleStatus)puzzleStatus.textContent='Соединяй одинаковые плитки.';
    displayPuzzle();
  }
  root.querySelectorAll?.('[data-vp-2048]')?.forEach(btn => btn.addEventListener('click',()=>movePuzzle(btn.dataset.vp2048)));
  puzzleReset?.addEventListener('click',()=>{haptic();resetPuzzle();});
  let touch=null;
  puzzleGrid?.addEventListener('touchstart',event=>{
    if(event.touches?.length!==1)return;
    touch={x:event.touches[0].clientX,y:event.touches[0].clientY};
  },{passive:true});
  puzzleGrid?.addEventListener('touchend',event=>{
    if(!touch||!event.changedTouches?.length)return;
    const dx=event.changedTouches[0].clientX-touch.x, dy=event.changedTouches[0].clientY-touch.y;
    touch=null;
    if(Math.max(Math.abs(dx),Math.abs(dy))<24)return;
    movePuzzle(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));
  },{passive:true});
  document.addEventListener('keydown',event=>{
    if(!root.classList?.contains('active'))return;
    const target=event.target;
    if(target?.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(target?.tagName))return;
    const map={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};
    if(map[event.key]){event.preventDefault?.();movePuzzle(map[event.key]);}
  });
  resetTtt();
  resetPuzzle();
})();
