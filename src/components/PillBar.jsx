// 横長楕円の薬型モチーフ棒グラフ
// doseAmount : '1錠'/'1.5錠'/'2錠'/'半錠'/'全量'/'1/3'/'2/3' 等
// administered: 0〜100（投薬済み%）
// showLabel   : 処方量ラベルを表示するか（デフォルトtrue）
export default function PillBar({ doseAmount = '1錠', administered = 0, showLabel = true }) {
  // 投薬量文字列から実数値（錠数）を計算（1.5錠 → 1.5）
  const parsePillCount = (dose) => {
    if (dose === '全量') return 1
    if (dose === '半錠') return 0.5
    if (dose === '1/3')  return 1 / 3
    if (dose === '2/3')  return 2 / 3
    const m = dose.match(/^(\d+(?:\.\d+)?)錠$/)
    return m ? parseFloat(m[1]) : 1
  }

  const totalPills = parsePillCount(doseAmount)
  const totalFilled = (administered / 100) * totalPills

  // 整数部のフル錠 + 端数錠をセグメントに分割
  // 例: 1.5錠 → [1, 0.5]、2錠 → [1, 1]、半錠 → [0.5]
  const numFull = Math.floor(totalPills + 0.001)
  const fraction = Math.round((totalPills - numFull) * 1000) / 1000
  const segments = []
  for (let i = 0; i < numFull; i++) segments.push(1)
  if (fraction > 0.05) segments.push(fraction)
  if (segments.length === 0) segments.push(1)

  // 各セグメントの充填率（そのセグメント内で何%満たされているか）
  const getSegmentFill = (idx) => {
    const filledBefore = segments.slice(0, idx).reduce((s, c) => s + c, 0)
    const cap = segments[idx]
    const fillHere = Math.min(cap, Math.max(0, totalFilled - filledBefore))
    return (fillHere / cap) * 100
  }

  const getFillClass = (pct) => {
    if (pct <= 0)   return ''
    if (pct >= 100) return 'pill-bar-fill-done'
    if (pct >= 50)  return 'pill-bar-fill-mid'
    return 'pill-bar-fill-low'
  }

  const statusColor = administered >= 100 ? 'text-emerald-600' : administered > 0 ? 'text-amber-600' : 'text-gray-400'

  return (
    <div className="flex flex-col gap-1.5">
      {/* セグメントを flex の比率で横並び（1.5錠は1錠の1.5倍の幅） */}
      <div className="flex gap-1.5 items-center">
        {segments.map((cap, i) => {
          const fillPct = getSegmentFill(i)
          return (
            <div
              key={i}
              className="pill-bar"
              style={{ flex: cap, minWidth: `${Math.max(20, cap * 40)}px` }}
            >
              <div className={`pill-bar-fill ${getFillClass(fillPct)}`} style={{ width: `${fillPct}%` }} />
            </div>
          )
        })}
        <span className={`text-xs font-bold ml-1 w-10 text-right tabular-nums flex-shrink-0 ${statusColor}`}>
          {administered}%
        </span>
      </div>

      {showLabel && (
        <p className="text-xs pl-0.5 text-gray-500">
          処方量：<span className="font-bold text-gray-700">{doseAmount}</span>
        </p>
      )}
    </div>
  )
}
