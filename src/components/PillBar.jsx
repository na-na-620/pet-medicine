// 横長楕円の薬型モチーフ棒グラフ
// doseAmount : '1錠'/'2錠'/'半錠'/'全量'/'1/3'/'2/3' 等
// administered: 0〜100（投薬済み%）
// showLabel   : 処方量ラベルを表示するか（デフォルトtrue）
export default function PillBar({ doseAmount = '1錠', administered = 0, width = '100%', showLabel = true }) {
  // 投薬量文字列から表示するピル数を計算
  const parsePillCount = (dose) => {
    if (dose === '全量' || dose === '半錠' || dose === '1/3' || dose === '2/3') return 1
    const m = dose.match(/^(\d+(?:\.\d+)?)錠$/)
    return m ? Math.max(1, Math.round(parseFloat(m[1]))) : 1
  }

  const pillCount = parsePillCount(doseAmount)

  // 各ピルの充填率を計算（左から順に充填）
  const getFillForPill = (index) => {
    const totalFilled = (administered / 100) * pillCount
    return Math.min(1, Math.max(0, totalFilled - index)) * 100
  }

  // 充填率に応じたグラデーション色
  const getFillClass = (pct) => {
    if (pct <= 0)  return ''
    if (pct >= 100) return 'pill-bar-fill-done'
    if (pct >= 50)  return 'pill-bar-fill-mid'
    return 'pill-bar-fill-low'
  }

  const statusColor = administered >= 100 ? 'text-emerald-600' : administered > 0 ? 'text-amber-600' : 'text-gray-400'

  return (
    <div className="flex flex-col gap-1.5" style={{ width }}>
      {/* ピル群（横並び）*/}
      <div className="flex gap-1.5 items-center">
        {Array.from({ length: pillCount }).map((_, i) => {
          const fillPct = getFillForPill(i)
          return (
            <div key={i} className="pill-bar flex-1" style={{ minWidth: 48 }}>
              <div className={`pill-bar-fill ${getFillClass(fillPct)}`} style={{ width: `${fillPct}%` }} />
              {/* 点線区切りは廃止 */}
            </div>
          )
        })}
        {/* 投薬済み% */}
        <span className={`text-xs font-bold ml-1 w-10 text-right tabular-nums ${statusColor}`}>
          {administered}%
        </span>
      </div>

      {/* 処方量ラベル（showLabel=trueのときのみ表示） */}
      {showLabel && (
        <p className="text-xs pl-0.5 text-gray-500">
          処方量：<span className="font-bold text-gray-700">{doseAmount}</span>
        </p>
      )}
    </div>
  )
}
