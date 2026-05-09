import { useEffect, useRef, useState } from 'react'
import './App.css'

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600
const PADDLE_WIDTH = 100
const PADDLE_HEIGHT = 15
const BALL_RADIUS = 8
const BRICK_ROWS = 6
const BRICK_COLS = 10
const BRICK_WIDTH = 70
const BRICK_HEIGHT = 25
const BRICK_PADDING = 5
const BRICK_OFFSET_TOP = 50
const BRICK_OFFSET_LEFT = 5

const LEVELS = [
  // Level 1 - Basic pattern
  {
    pattern: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ]
  },
  // Level 2 - Checkerboard
  {
    pattern: [
      [1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
      [0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
      [1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
      [0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
      [1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
      [0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
    ]
  },
  // Level 3 - Pyramid
  {
    pattern: [
      [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
      [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ]
  },
  // Level 4 - Stripes
  {
    pattern: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ]
  },
  // Level 5 - Random
  {
    pattern: [
      [1, 1, 0, 1, 1, 1, 0, 1, 1, 1],
      [1, 0, 1, 1, 0, 1, 1, 0, 1, 0],
      [0, 1, 1, 0, 1, 0, 1, 1, 0, 1],
      [1, 1, 0, 1, 0, 1, 0, 1, 1, 0],
      [0, 0, 1, 1, 1, 1, 1, 0, 0, 1],
      [1, 1, 1, 0, 1, 1, 0, 1, 1, 1],
    ]
  }
]

const BRICK_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD']

const playSound = (frequency, type = 'sine', duration = 0.1) => {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  const oscillator = audioCtx.createOscillator()
  const gainNode = audioCtx.createGain()

  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime)

  gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration)

  oscillator.connect(gainNode)
  gainNode.connect(audioCtx.destination)

  oscillator.start()
  oscillator.stop(audioCtx.currentTime + duration)
}

function App() {
  const canvasRef = useRef(null)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [level, setLevel] = useState(1)
  const [gameState, setGameState] = useState('waiting') // waiting, playing, gameover, win
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('bulletBallHighScore')
    return saved ? parseInt(saved) : 0
  })

  const gameRef = useRef({
    paddle: { x: CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2, width: PADDLE_WIDTH, y: CANVAS_HEIGHT - PADDLE_HEIGHT - 5 },
    balls: [],
    bricks: [],
    powerUps: [],
    bullets: [],
    keys: { a: false, d: false },
    autoShoot: false,
    shootTimer: 0,
    specialBrickHit: 0
  })

  const initLevel = (lvl) => {
    const pattern = LEVELS[(lvl - 1) % LEVELS.length].pattern
    const bricks = []
    
    for (let row = 0; row < BRICK_ROWS; row++) {
      for (let col = 0; col < BRICK_COLS; col++) {
        if (pattern[row][col]) {
          const isSpecial = Math.random() < 0.15 // 15% chance for special brick
          bricks.push({
            x: BRICK_OFFSET_LEFT + col * (BRICK_WIDTH + BRICK_PADDING),
            y: BRICK_OFFSET_TOP + row * (BRICK_HEIGHT + BRICK_PADDING),
            width: BRICK_WIDTH,
            height: BRICK_HEIGHT,
            hits: isSpecial ? 2 : 1,
            color: BRICK_COLORS[row % BRICK_COLORS.length],
            isSpecial,
            active: true
          })
        }
      }
    }
    
    gameRef.current.bricks = bricks
    gameRef.current.balls = [{
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT - 50,
      dx: 4 * (Math.random() > 0.5 ? 1 : -1),
      dy: -4,
      active: true
    }]
    gameRef.current.powerUps = []
    gameRef.current.bullets = []
    gameRef.current.paddle.x = CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2
    gameRef.current.paddle.width = PADDLE_WIDTH
    gameRef.current.autoShoot = false
    gameRef.current.specialBrickHit = 0
  }

  const spawnPowerUp = (x, y) => {
    const types = ['multiball', 'widen', 'autoshoot']
    const type = types[Math.floor(Math.random() * types.length)]
    gameRef.current.powerUps.push({
      x, y, width: 20, height: 20, type, dy: 2,
      color: type === 'multiball' ? '#FFD700' : type === 'widen' ? '#00FF00' : '#FF00FF'
    })
  }

  const shootBullet = () => {
    const { paddle } = gameRef.current
    gameRef.current.bullets.push({
      x: paddle.x + paddle.width / 2,
      y: paddle.y - 10,
      dy: -8,
      width: 4,
      height: 10
    })
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animationId

    const handleKeyDown = (e) => {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') gameRef.current.keys.a = true
      if (e.code === 'KeyD' || e.code === 'ArrowRight') gameRef.current.keys.d = true
      if (e.code === 'Space') {
        if (gameState === 'waiting' || gameState === 'gameover' || gameState === 'win') {
          setGameState('playing')
          setScore(0)
          setLives(3)
          setLevel(1)
          initLevel(1)
        }
      }
    }

    const handleKeyUp = (e) => {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') gameRef.current.keys.a = false
      if (e.code === 'KeyD' || e.code === 'ArrowRight') gameRef.current.keys.d = false
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    const update = () => {
      if (gameState !== 'playing') return

      const { paddle, balls, bricks, powerUps, bullets, keys, autoShoot } = gameRef.current

      // Move paddle
      if (keys.a && paddle.x > 0) paddle.x -= 8
      if (keys.d && paddle.x < CANVAS_WIDTH - paddle.width) paddle.x += 8

      // Auto shoot
      if (autoShoot) {
        gameRef.current.shootTimer++
        if (gameRef.current.shootTimer >= 15) {
          shootBullet()
          gameRef.current.shootTimer = 0
        }
      }

      // Update balls
      balls.forEach(ball => {
        if (!ball.active) return
        ball.x += ball.dx
        ball.y += ball.dy

        // Wall collision
        if (ball.x - BALL_RADIUS < 0 || ball.x + BALL_RADIUS > CANVAS_WIDTH) ball.dx *= -1
        if (ball.y - BALL_RADIUS < 0) ball.dy *= -1

        // Paddle collision
        if (ball.y + BALL_RADIUS > paddle.y &&
            ball.y - BALL_RADIUS < paddle.y + PADDLE_HEIGHT &&
            ball.x > paddle.x && ball.x < paddle.x + paddle.width) {
          ball.dy = -Math.abs(ball.dy)
          const hitPos = (ball.x - paddle.x) / paddle.width
          ball.dx = 6 * (hitPos - 0.5)
        }

        // Ball out
        if (ball.y > CANVAS_HEIGHT) ball.active = false

        // Brick collision
        bricks.forEach(brick => {
          if (!brick.active) return
          if (ball.x > brick.x && ball.x < brick.x + brick.width &&
              ball.y > brick.y && ball.y < brick.y + brick.height) {
            ball.dy *= -1
            brick.hits--
            playSound(440, 'sine', 0.1)
            if (brick.hits <= 0) {
              brick.active = false
              setScore(s => s + (brick.isSpecial ? 50 : 10))
              if (brick.isSpecial) spawnPowerUp(brick.x + brick.width / 2, brick.y + brick.height / 2)
            }
          }
        })
      })

      // Update power-ups
      powerUps.forEach((pu, index) => {
        pu.y += pu.dy
        if (pu.y > CANVAS_HEIGHT) {
          powerUps.splice(index, 1)
          return
        }
        if (pu.y + pu.height > paddle.y &&
            pu.y - pu.height < paddle.y + PADDLE_HEIGHT &&
            pu.x + pu.width > paddle.x && pu.x < paddle.x + paddle.width) {
          if (pu.type === 'multiball') {
            const newBalls = []
            balls.forEach(ball => {
              if (ball.active) {
                newBalls.push({ ...ball, dx: ball.dx * 0.8, dy: -4 })
                newBalls.push({ ...ball, dx: -ball.dx * 0.8, dy: -4 })
                newBalls.push({ ...ball, dx: ball.dx, dy: -4 })
              }
            })
            gameRef.current.balls = newBalls
          } else if (pu.type === 'widen') {
            paddle.width = Math.min(paddle.width + 30, 200)
          } else if (pu.type === 'autoshoot') {
            gameRef.current.autoShoot = true
          }
          powerUps.splice(index, 1)
          setScore(s => s + 25)
        }
      })

      // Update bullets
      bullets.forEach((bullet, bIndex) => {
        bullet.y += bullet.dy
        if (bullet.y < 0) {
          bullets.splice(bIndex, 1)
          return
        }
        bricks.forEach(brick => {
          if (!brick.active) return
          if (bullet.x > brick.x && bullet.x < brick.x + brick.width &&
              bullet.y > brick.y && bullet.y < brick.y + brick.height) {
            bullets.splice(bIndex, 1)
            brick.hits--
            playSound(660, 'square', 0.05)
            if (brick.hits <= 0) {
              brick.active = false
              setScore(s => s + (brick.isSpecial ? 50 : 10))
              if (brick.isSpecial) spawnPowerUp(brick.x + brick.width / 2, brick.y + brick.height / 2)
            }
          }
        })
      })

      // Check lives
      const activeBalls = balls.filter(b => b.active)
      if (activeBalls.length === 0) {
        setLives(l => {
          const newLives = l - 1
          if (newLives <= 0) {
            setGameState('gameover')
            if (score > highScore) {
              setHighScore(score)
              localStorage.setItem('bulletBallHighScore', score.toString())
            }
          } else {
            gameRef.current.balls = [{
              x: gameRef.current.paddle.x + gameRef.current.paddle.width / 2,
              y: gameRef.current.paddle.y - BALL_RADIUS,
              dx: 4 * (Math.random() > 0.5 ? 1 : -1),
              dy: -4,
              active: true
            }]
          }
          return newLives
        })
      }

      // Check level complete
      const activeBricks = bricks.filter(b => b.active)
      if (activeBricks.length === 0) {
        if (level >= LEVELS.length) {
          setGameState('win')
          if (score > highScore) {
            setHighScore(score)
            localStorage.setItem('bulletBallHighScore', score.toString())
          }
        } else {
          setLevel(l => l + 1)
          initLevel(level + 1)
        }
      }
    }

    const draw = () => {
      // Clear
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      const { paddle, balls, bricks, powerUps, bullets } = gameRef.current

      // Draw paddle
      ctx.fillStyle = '#00ff88'
      ctx.fillRect(paddle.x, paddle.y, paddle.width, PADDLE_HEIGHT)

      // Draw balls
      balls.forEach(ball => {
        if (!ball.active) return
        ctx.beginPath()
        ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2)
        ctx.fillStyle = '#ffffff'
        ctx.fill()
        ctx.closePath()
      })

      // Draw bricks
      bricks.forEach(brick => {
        if (!brick.active) return
        ctx.fillStyle = brick.isSpecial ? '#FFD700' : brick.color
        ctx.fillRect(brick.x, brick.y, brick.width, brick.height)
        if (brick.isSpecial) {
          ctx.fillStyle = '#000'
          ctx.font = '12px Arial'
          ctx.fillText('★', brick.x + brick.width / 2 - 5, brick.y + brick.height / 2 + 4)
        }
      })

      // Draw power-ups
      powerUps.forEach(pu => {
        ctx.fillStyle = pu.color
        ctx.beginPath()
        ctx.arc(pu.x + pu.width / 2, pu.y + pu.height / 2, pu.width / 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#000'
        ctx.font = '10px Arial'
        const symbol = pu.type === 'multiball' ? 'x3' : pu.type === 'widen' ? '↔' : '🔫'
        ctx.fillText(symbol, pu.x + pu.width / 2 - 6, pu.y + pu.height / 2 + 4)
      })

      // Draw bullets
      ctx.fillStyle = '#ff4444'
      bullets.forEach(bullet => {
        ctx.fillRect(bullet.x - bullet.width / 2, bullet.y, bullet.width, bullet.height)
      })

      // Draw UI
      ctx.fillStyle = '#ffffff'
      ctx.font = '20px Arial'
      ctx.fillText(`Score: ${score}`, 10, 30)
      ctx.fillText(`High Score: ${highScore}`, 10, 60)

      // Draw lives as hearts
      const heartX = CANVAS_WIDTH - 30;
      const heartY = 30;
      for (let i = 0; i < 3; i++) {
        if (i < lives) {
          ctx.fillStyle = '#ff0000';
          ctx.font = '20px Arial';
          ctx.fillText('❤️', heartX - i * 30, heartY);
        } else {
          ctx.fillStyle = '#555';
          ctx.font = '20px Arial';
          ctx.fillText('🖤', heartX - i * 30, heartY);
        }
      }

      ctx.fillText(`Level: ${level}`, CANVAS_WIDTH / 2 - 40, 30);

      // Draw messages
      if (gameState === 'waiting') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
        ctx.fillStyle = '#ffffff'
        ctx.font = '40px Arial'
        ctx.textAlign = 'center'
        ctx.fillText('BULLET BALL', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40)
        ctx.font = '20px Arial'
        ctx.fillText('Press SPACE to Start', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10)
        ctx.fillText('A/D or ←/→ to Move', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50)
        ctx.textAlign = 'left'
      }

      if (gameState === 'gameover') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
        ctx.fillStyle = '#ff4444'
        ctx.font = '40px Arial'
        ctx.textAlign = 'center'
        ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20)
        ctx.fillStyle = '#ffffff'
        ctx.font = '20px Arial'
        ctx.fillText(`Final Score: ${score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20)
        ctx.fillText(`High Score: ${highScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40)
        ctx.fillText('Press SPACE to Restart', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60)
        ctx.textAlign = 'left'
      }

      if (gameState === 'win') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
        ctx.fillStyle = '#00ff88'
        ctx.font = '40px Arial'
        ctx.textAlign = 'center'
        ctx.fillText('YOU WIN!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20)
        ctx.fillStyle = '#ffffff'
        ctx.font = '20px Arial'
        ctx.fillText(`Final Score: ${score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20)
        ctx.fillText('Press SPACE to Play Again', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60)
        ctx.textAlign = 'left'
      }
    }

    const gameLoop = () => {
      update()
      draw()
      animationId = requestAnimationFrame(gameLoop)
    }

    gameLoop()

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      cancelAnimationFrame(animationId)
    }
  }, [gameState, level, score, lives, highScore])

  return (
    <div className="app">
      <h1>Bullet Ball</h1>
      <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
      <div className="instructions">
        <p>🎯 <strong>Mục tiêu:</strong> Phá hết tất cả viên gạch</p>
        <p>⌨️ <strong>Điều khiển:</strong> A/D hoặc ←/→ để di chuyển</p>
        <p>🚀 <strong>Bắt đầu:</strong> Nhấn SPACE</p>
        <p>⭐ <strong>Gạch đặc biệt (★):</strong> Vỡ sau 2 lần đập, rơi power-up</p>
        <div className="powerups">
          <span className="powerup multiball">⚡ x3 Bóng</span>
          <span className="powerup widen">↔ Thanh dài</span>
          <span className="powerup autoshoot">🔫 Bắn tự động</span>
        </div>
      </div>
    </div>
  )
}

export default App
