Add-Type -AssemblyName System.Drawing

$Assets = Split-Path -Parent $MyInvocation.MyCommand.Path
$SvgPath = Join-Path $Assets "ember-icon.svg"
$PngPath = Join-Path $Assets '$devvit_icon.png'

$SvgText = @"
<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" rx="220" fill="#101827"/>
  <circle cx="512" cy="512" r="360" fill="#151E2F" stroke="#293246" stroke-width="28"/>
  <circle cx="512" cy="512" r="420" stroke="#FF6B35" stroke-width="22" stroke-opacity="0.55"/>
  <path d="M338 736C292 623 344 528 432 452C497 396 493 287 574 202C573 315 659 367 706 448C781 578 720 788 532 836C447 858 371 815 338 736Z" fill="#FF6B35"/>
  <path d="M432 724C400 642 438 585 489 538C526 504 536 442 579 398C574 472 632 509 654 572C687 666 628 780 523 807C481 818 449 765 432 724Z" fill="#FFD166"/>
  <path d="M302 676C346 579 424 528 512 528C600 528 678 579 722 676" stroke="#F8FAFC" stroke-width="44" stroke-linecap="round"/>
  <path d="M512 660L610 562" stroke="#F8FAFC" stroke-width="34" stroke-linecap="round"/>
  <circle cx="512" cy="662" r="30" fill="#F8FAFC"/>
</svg>
"@
Set-Content -LiteralPath $SvgPath -Value $SvgText -Encoding UTF8

$Size = 1024
$Bitmap = New-Object System.Drawing.Bitmap $Size, $Size
$Graphics = [System.Drawing.Graphics]::FromImage($Bitmap)
$Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

function New-Brush($Hex) {
  return New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($Hex))
}

function New-RoundPen($Hex, $Width) {
  $Pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml($Hex)), $Width
  $Pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $Pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  return $Pen
}

$Bg = New-Brush '#101827'
$Panel = New-Brush '#151E2F'
$Orange = New-Brush '#FF6B35'
$Yellow = New-Brush '#FFD166'
$White = New-Brush '#F8FAFC'
$RingPen = New-RoundPen '#293246' 28
$AccentPen = New-RoundPen '#FF6B35' 22
$AccentPen.Color = [System.Drawing.Color]::FromArgb(140, 255, 107, 53)

$Graphics.FillRectangle($Bg, 0, 0, $Size, $Size)
$Graphics.FillEllipse($Panel, 152, 152, 720, 720)
$Graphics.DrawEllipse($RingPen, 152, 152, 720, 720)
$Graphics.DrawEllipse($AccentPen, 92, 92, 840, 840)

$FlamePath = New-Object System.Drawing.Drawing2D.GraphicsPath
$FlamePath.StartFigure()
$FlamePath.AddBezier(338, 736, 292, 623, 344, 528, 432, 452)
$FlamePath.AddBezier(432, 452, 497, 396, 493, 287, 574, 202)
$FlamePath.AddBezier(574, 202, 573, 315, 659, 367, 706, 448)
$FlamePath.AddBezier(706, 448, 781, 578, 720, 788, 532, 836)
$FlamePath.AddBezier(532, 836, 447, 858, 371, 815, 338, 736)
$FlamePath.CloseFigure()
$Graphics.FillPath($Orange, $FlamePath)

$InnerPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$InnerPath.StartFigure()
$InnerPath.AddBezier(432, 724, 400, 642, 438, 585, 489, 538)
$InnerPath.AddBezier(489, 538, 526, 504, 536, 442, 579, 398)
$InnerPath.AddBezier(579, 398, 574, 472, 632, 509, 654, 572)
$InnerPath.AddBezier(654, 572, 687, 666, 628, 780, 523, 807)
$InnerPath.AddBezier(523, 807, 481, 818, 449, 765, 432, 724)
$InnerPath.CloseFigure()
$Graphics.FillPath($Yellow, $InnerPath)

$Graphics.DrawArc((New-RoundPen '#F8FAFC' 44), 282, 460, 460, 430, 196, 148)
$Graphics.DrawLine((New-RoundPen '#F8FAFC' 34), 512, 660, 610, 562)
$Graphics.FillEllipse($White, 482, 632, 60, 60)

$Graphics.Dispose()
$Bitmap.Save($PngPath, [System.Drawing.Imaging.ImageFormat]::Png)
$Bitmap.Dispose()

$File = Get-Item -LiteralPath $PngPath
Write-Output "Created $PngPath ($([math]::Round($File.Length / 1KB, 1)) KB)"
