/* VETOGRAM 7.3 Arcade: two real device-local games.
 * No backend, Telegram identity, remote scripts, chat access or API calls.
 */
(() => {
 'use strict';
 const root=document.querySelector('.screen[data-screen="play"]');
 if(!root)return;
 const $=id=>root.querySelector(id);
 const safeRead=key=>{try {const n=Number(window.localStorage?.getItem(key));return Number.isFinite(n)&&n>=0?n:0;}catch{return 0;}};
 const safeSave=(key,n)=>{try{window.localStorage?.setItem(key,String(n));}catch{}};
 const haptic=()=>{try{window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');}catch{}};
 const MINES_SIZE=6,MINES_TOTAL=6,MINES_COUNT=36,MINES_WINS_KEY='vetogram:play:mines-wins:v1';
 const minesGrid=$('#vpMinesGrid'),minesStatus=$('#vpMinesStatus'),minesMode=$('#vpMinesMode');
 const minesReset=$('#vpMinesReset'),minesRemaining=$('#vpMinesRemaining'),minesWins=$('#vpMinesWins');
 let cells=[],minesStarted=false,minesFinished=false,flags=0,flagMode=false;
 let cancelHolds=[];
 const clearAllHolds=()=>{for(const stop of cancelHolds)stop();};
 const around=(id,size=MINES_SIZE)=>{
   const x=id%size,y=Math.floor(id/size),result=[];
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
     if(!dx&&!dy)continue;
     const nx=x+dx,ny=y+dy;
     if(nx>=0&&nx<size&&ny>=0&&ny<size)result.push(ny*size+nx);
   }
   return result;
 };
 function mineSeed(first){
   const protectedCells=new Set([first,...around(first)]);
   const available=[];
   for(let i=0;i<MINES_COUNT;i++)if(!protectedCells.has(i))available.push(i);
   // Fisher–Yates: fair mine placement, including a safe first 3x3 neighborhood.
   for(let i=available.length-1;i>0;i--){
     const j=Math.floor(Math.random()*(i+1));
     [available[i],available[j]]=[available[j],available[i]];
   }
   for(const id of available.slice(0,MINES_TOTAL))cells[id].mine=true;
   for(let i=0;i<MINES_COUNT;i++)cells[i].count=around(i).filter(n=>cells[n].mine).length;
   minesStarted=true;
 }
 function paintMines(){
   if(!minesGrid)return;
   const buttons=Array.from(minesGrid.children);
   cells.forEach((c,i)=>{
     const button=buttons[i];if(!button)return;
     button.className='v73-mine-cell'+(c.revealed?' is-open':'')+(c.flagged?' is-flagged':'')+(c.revealed&&c.mine?' is-mine':'');
     button.dataset.count=String(c.revealed&&!c.mine?c.count:0);
     button.textContent=c.revealed?(c.mine?'✹':c.count?String(c.count):''):c.flagged?'⚑':'';
     button.setAttribute('aria-label','Клетка '+(i+1)+(c.flagged?' — флаг':c.revealed?(c.mine?' — мина':c.count?' — '+c.count+' рядом':' — пуста'):' — закрыта'));
     button.disabled=minesFinished||(c.revealed&&c.count===0);
   });
   if(minesRemaining)minesRemaining.textContent='Мины: '+Math.max(0,MINES_TOTAL-flags);
   if(minesWins)minesWins.textContent='Побед: '+safeRead(MINES_WINS_KEY);
   if(minesMode){minesMode.textContent=flagMode?'Режим: флажки ⚑':'Режим: открывать';minesMode.setAttribute('aria-pressed',String(flagMode));}
 }
 function finishMines(win){
   minesFinished=true;
   if(win){
     safeSave(MINES_WINS_KEY,safeRead(MINES_WINS_KEY)+1);
     minesStatus.textContent='Все безопасные клетки открыты! Победа.';
     haptic();
   }else{
     for(const cell of cells)if(cell.mine)cell.revealed=true;
     minesStatus.textContent='Ты наткнулся на мину. Попробуй ещё раз.';
   }
 }
 function mineAction(id,asFlag=false){
   if(minesFinished||!cells[id]||cells[id].revealed)return;
   const cell=cells[id];
   if(asFlag||flagMode){
     if(!cell.flagged&&flags>=MINES_TOTAL){minesStatus.textContent='Все шесть флажков уже расставлены.';return;}
     cell.flagged=!cell.flagged;flags+=cell.flagged?1:-1;
     minesStatus.textContent=cell.flagged?'Место отмечено флажком.':'Флажок снят.';
     paintMines();return;
   }
   if(cell.flagged)return;
   if(!minesStarted)mineSeed(id);
   if(cell.mine){finishMines(false);paintMines();return;}
   const queue=[id],seen=new Set();
   while(queue.length){
     const at=queue.pop();
     if(seen.has(at))continue;seen.add(at);
     const found=cells[at];if(found.revealed||found.flagged||found.mine)continue;
     found.revealed=true;
     if(found.count===0)for(const near of around(at))queue.push(near);
   }
   if(cells.filter(c=>c.revealed&&!c.mine).length===MINES_COUNT-MINES_TOTAL)finishMines(true);
   else minesStatus.textContent='Открывай клетки. Ноль раскрывает соседей.';
   paintMines();
 }
 // Traditional Minesweeper chord: tap an opened numbered cell once its
 // neighboring flag count matches the number. Incorrect flags can still
 // expose a mine; no invisible hints or information are revealed.
 function chordMines(id){
   const cell=cells[id];
   if(minesFinished||flagMode||!cell?.revealed||!cell.count)return;
   const neighbors=around(id);
   const marked=neighbors.filter(n=>cells[n].flagged).length;
   if(marked!==cell.count){
     minesStatus.textContent='Для раскрытия соседей отметь '+cell.count+' мин вокруг числа.';
     return;
   }
   for(const next of neighbors){
     if(minesFinished)break;
     if(!cells[next].revealed&&!cells[next].flagged)mineAction(next);
   }
 }
 function resetMines(){
   clearAllHolds();cancelHolds=[];
   cells=Array.from({length:MINES_COUNT},()=>({mine:false,revealed:false,flagged:false,count:0}));
   minesStarted=false;minesFinished=false;flags=0;flagMode=false;
   if(minesGrid){
     minesGrid.replaceChildren();
     for(let i=0;i<MINES_COUNT;i++){
       const button=document.createElement('button');
       button.type='button';button.className='v73-mine-cell';
       let longPress=null,ignoreClick=false;
       const clearHold=()=>{if(longPress!==null){clearTimeout(longPress);longPress=null;}};
       cancelHolds.push(clearHold);
       button.addEventListener('pointerdown',e=>{
         // Start every new interaction with a fresh tap state. Right-click
         // never suppresses the next ordinary left-click.
         ignoreClick=false;
         if(e.pointerType!=='touch'&&e.pointerType!=='pen')return;
         clearHold();
         longPress=setTimeout(()=>{
           longPress=null;ignoreClick=true;
           if(!cells[i]?.revealed&&!minesFinished)mineAction(i,true);
         },440);
       });
       for(const event of ['pointerup','pointercancel','pointerleave'])button.addEventListener(event,clearHold);
       button.addEventListener('click',()=>{
         if(ignoreClick){ignoreClick=false;return;}
         if(cells[i]?.revealed)chordMines(i);
         else mineAction(i);
       });
       button.addEventListener('contextmenu',e=>{
         e.preventDefault?.();clearHold();
         if(ignoreClick)return;
         if(!cells[i]?.revealed&&!minesFinished){ignoreClick=true;mineAction(i,true);}
       });
       minesGrid.appendChild(button);
     }
   }
   if(minesStatus)minesStatus.textContent='Первый ход безопасный. Удерживай клетку для флажка или нажми открытое число для раскрытия соседей.';
   paintMines();
 }
 minesMode?.addEventListener('click',()=>{if(minesFinished)return;flagMode=!flagMode;paintMines();});
 minesReset?.addEventListener('click',()=>{resetMines();haptic();});
 window.addEventListener?.('vetogram:game-close',event=>{if(event?.detail?.game==='mines')clearAllHolds();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clearAllHolds();});
 if(minesGrid&&minesStatus)resetMines();
 // SNAKE: model never advances unless the player explicitly starts it.
 const S=12,CELL_COUNT=S*S,SNAKE_BEST_KEY='vetogram:play:snake-best:v1';
 const snakeGrid=$('#vpSnakeGrid'),snakeStatus=$('#vpSnakeStatus'),snakeScore=$('#vpSnakeScore'),snakeBest=$('#vpSnakeBest');
 const snakeToggle=$('#vpSnakeToggle'),snakeReset=$('#vpSnakeReset');
 let snake=[],food=0,direction='right',nextDirection='right',points=0,phase='idle',timer=null;
 const coords=i=>[i%S,Math.floor(i/S)];
 const vectors={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]};
 const opposite=(a,b)=>vectors[a][0]+vectors[b][0]===0&&vectors[a][1]+vectors[b][1]===0;
 function stopClock(){if(timer!==null){clearInterval(timer);timer=null;}}
 function placeFood(){
   const open=[];for(let i=0;i<CELL_COUNT;i++)if(!snake.includes(i))open.push(i);
   food=open.length?open[Math.floor(Math.random()*open.length)]:-1;
 }
 function drawSnake(){
   if(!snakeGrid)return;
   const occupied=new Set(snake);
   Array.from(snakeGrid.children).forEach((el,i)=>{
     el.className='v73-snake-cell'+(snake[0]===i?' is-head':occupied.has(i)?' is-body':food===i?' is-food':'');
   });
   if(snakeScore)snakeScore.textContent='Очки: '+points;
   if(snakeBest)snakeBest.textContent='Рекорд: '+safeRead(SNAKE_BEST_KEY);
   if(snakeToggle)snakeToggle.textContent=phase==='running'?'Пауза':phase==='paused'?'Продолжить':phase==='over'?'Играть снова':'Начать игру';
 }
 function resetSnake(){
   stopClock();snake=[78,77,76];food=82;direction='right';nextDirection='right';points=0;phase='idle';
   if(snakeStatus)snakeStatus.textContent='Начни игру. Не врезайся в края или хвост.';
   drawSnake();
 }
 function gameOver(){
   stopClock();phase='over';haptic();
   if(snakeStatus)snakeStatus.textContent='Игра окончена. Очки: '+points+'. Попробуй ещё раз.';
   drawSnake();
 }
 function tick(){
   if(phase!=='running')return;
   direction=nextDirection;
   const [x,y]=coords(snake[0]),[dx,dy]=vectors[direction];
   const nx=x+dx,ny=y+dy;
   if(nx<0||ny<0||nx>=S||ny>=S){gameOver();return;}
   const head=ny*S+nx,grow=head===food;
   if((grow?snake:snake.slice(0,-1)).includes(head)){gameOver();return;}
   snake.unshift(head);
   if(grow){
     points+=10;haptic();
     if(points>safeRead(SNAKE_BEST_KEY))safeSave(SNAKE_BEST_KEY,points);
     if(snake.length===CELL_COUNT){stopClock();phase='over';if(snakeStatus)snakeStatus.textContent='Поле заполнено. Победа!';drawSnake();return;}
     placeFood();
   } else snake.pop();
   drawSnake();
 }
 function startSnake(){
   stopClock();phase='running';
   const speed=Math.max(100,205-Math.floor(points/50)*12);
   timer=setInterval(tick,speed);
   if(snakeStatus)snakeStatus.textContent='Игра идёт. Используй стрелки или свайпы.';
   drawSnake();
 }
 function snakeMove(to){
   if(!vectors[to]||phase==='over')return;
   // Prevent 180-degree turns, even if a player swipes twice between ticks.
   if(opposite(to,direction))return;
   nextDirection=to;
 }
 snakeToggle?.addEventListener('click',()=>{
   if(phase==='running'){stopClock();phase='paused';if(snakeStatus)snakeStatus.textContent='Пауза.';drawSnake();}
   else if(phase==='over'){resetSnake();startSnake();}
   else startSnake();
 });
 snakeReset?.addEventListener('click',()=>{resetSnake();haptic();});
 root.querySelectorAll('[data-vp-snake]').forEach(button=>button.addEventListener('click',()=>snakeMove(button.dataset.vpSnake)));
 if(snakeGrid){
   for(let i=0;i<CELL_COUNT;i++){
     const el=document.createElement('span');el.className='v73-snake-cell';el.setAttribute('aria-hidden','true');snakeGrid.appendChild(el);
   }
   let touch=null;
   snakeGrid.addEventListener('touchstart',e=>{const t=e.changedTouches?.[0];if(t)touch={x:t.clientX,y:t.clientY};},{passive:true});
   snakeGrid.addEventListener('touchend',e=>{
     const t=e.changedTouches?.[0];if(!t||!touch)return;
     const dx=t.clientX-touch.x,dy=t.clientY-touch.y;touch=null;
     if(Math.max(Math.abs(dx),Math.abs(dy))<20)return;
     snakeMove(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));
   },{passive:true});
 }
 document.addEventListener('keydown',e=>{
   // Snake captures arrows only in its native dialog or the focused V9
   // inline game. Never steal input from 2048, forms or page scrolling.
   const inlineSnake=root.classList?.contains('v9-arcade-active') &&
     root.dataset?.v9ActiveGame==='snake';
   if(phase!=='running'||document.hidden ||
      !(inlineSnake||snakeGrid?.closest?.('.vp-game-in-dialog')))return;
   const target=e.target;
   if(target?.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(target?.tagName))return;
   const map={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'};
   const dir=map[e.key];if(!dir)return;
   e.preventDefault?.();snakeMove(dir);
 });
 document.addEventListener('visibilitychange',()=>{
   if(document.hidden&&phase==='running'){stopClock();phase='paused';if(snakeStatus)snakeStatus.textContent='Пауза — приложение скрыто.';drawSnake();}
 });
 window.addEventListener?.('vetogram:game-close',event=>{
   if(event?.detail?.game==='snake'&&phase==='running'){
     stopClock();phase='paused';if(snakeStatus)snakeStatus.textContent='Пауза — игра закрыта.';drawSnake();
   }
 });
 if(snakeGrid&&snakeStatus)resetSnake();
})();
