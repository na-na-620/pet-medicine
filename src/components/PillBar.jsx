// 横長楕円の薬型モチーフ棒グラフ
// doseAmount: '1錠'/'2錠'/'半錠'/'全量'/'1/3'/'2/3' 等
// administered: 0〜100（投薬済み%）
export default function PillBar({ doseAmount = '1錠', administered = 0, width = '100%' }) {
  // 投薬量文字列から錠数（表示するピル数）を計算
  const parsePillCount = (dose) => {
    if (dose === '全量' || dose === '半錠' || dose === '1/3' || dose === '2/3') return 1
    const m = dose.match(/^(\d+(?:\.\d+)?)錠$/)
    return m ? Math.max(1, Math.round(parseFloat(m[1]))) : 1
  }

  const pillCount = parsePillCount(doseAmount)

  // 各ピルの充填率を計算（administered%をpillCount個のピルに均等分配し、左から順に充填）
  const getFillForPill = (index) => {
    const totalFilled = (administered / 100) * pillCount  // 充填済み錠数（小数OK）
    const filled = Math.min(1, Math.max(0, totalFilled - index))  // このピルの充填率(0〜1)
    return filled * 100
  }

  // 充填率に応じたグラデーション色クラスを返す
  const getFillClass = (pct) => {
    if (pct <= 0) return ''
    if (pct >= 100) return 'pill-bar-fill-done'
    if (pct >= 50) return 'pill-bar-fill-mid'
    return 'pill-bar-fill-low'
  }

  const statusColor = administered >= 100 ? 'text-emerald-600' : administered > 0 ? 'text-amber-600' : 'text-gray-400'

  return (
    <div className="flex flex-col gap-1" style={{ width }}>
      {/* ピル群（横並び） */}
      <div className="flex gap-1.5 items-center">
        {Array.from({ length: pillCount }).map((_, i) => {
          const fillPct = getFillForPill(i)
          return (
            <div key={i} className="pill-bar flex-1 relative" style={{ minWidth: 48 }}>
              <div
                className={`pill-bar-fill ${getFillClass(fillPct)}`}
                style={{ width: `${fillPct}%` }}
              />
              {/* 半錠・1/3・2/3の場合は点線で区切りを表示 */}
              {(doseAmount === '半錠' || doseAmount === '1/3' || doseAmount === '2/3') && (
                <div className="absolute inset-y-0 left-1/2 border-l-2 border-dashed border-gray-300 opacity-60" />
              )}
            </div>
          )
        })}

        {/* 投薬済み% テキスト */}
        <span className={`text-xs font-bold ml-1 w-10 text-right ${statusColor}`}>
          {administered}%
        </span>
      </div>

      {/* 投薬量ラベル */}
      <p className="text-xs text-gray-400 pl-0.5">処方量：{doseAmount}</p>
    </div>
  )
}
