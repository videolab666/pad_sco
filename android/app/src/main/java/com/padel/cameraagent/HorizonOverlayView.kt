package com.padel.cameraagent

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.util.AttributeSet
import android.view.View
import java.util.Locale
import kotlin.math.abs

class HorizonOverlayView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : View(context, attrs, defStyleAttr) {
    private val guidePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(85, 255, 255, 255)
        strokeWidth = resources.displayMetrics.density
    }
    private val shadowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(190, 0, 0, 0)
        strokeWidth = resources.displayMetrics.density * 5f
        strokeCap = Paint.Cap.ROUND
    }
    private val levelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        strokeWidth = resources.displayMetrics.density * 2f
        strokeCap = Paint.Cap.ROUND
    }
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textAlign = Paint.Align.CENTER
        textSize = resources.displayMetrics.scaledDensity * 13f
        setShadowLayer(resources.displayMetrics.density * 2f, 0f, resources.displayMetrics.density, Color.BLACK)
    }

    var rollDegrees: Float = 0f
        set(value) {
            field = value.coerceIn(-45f, 45f)
            invalidate()
        }

    var isOrientationValid: Boolean = true
        set(value) {
            field = value
            invalidate()
        }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val w = width.toFloat()
        val h = height.toFloat()
        canvas.drawLine(w / 3f, 0f, w / 3f, h, guidePaint)
        canvas.drawLine(2f * w / 3f, 0f, 2f * w / 3f, h, guidePaint)
        canvas.drawLine(0f, h / 3f, w, h / 3f, guidePaint)
        canvas.drawLine(0f, 2f * h / 3f, w, 2f * h / 3f, guidePaint)

        val centerX = w / 2f
        val centerY = h / 2f
        if (!isOrientationValid) {
            canvas.drawText(
                context.getString(R.string.horizon_aim_at_court),
                centerX,
                centerY - resources.displayMetrics.density * 14f,
                textPaint,
            )
            return
        }
        val halfLength = (w * 0.16f).coerceIn(100f, 360f)
        val isLevel = abs(rollDegrees) <= LEVEL_TOLERANCE_DEGREES
        levelPaint.color = if (isLevel) Color.rgb(164, 251, 35) else Color.WHITE
        canvas.save()
        canvas.rotate(-rollDegrees, centerX, centerY)
        canvas.drawLine(centerX - halfLength, centerY, centerX + halfLength, centerY, shadowPaint)
        canvas.drawLine(centerX - halfLength, centerY, centerX + halfLength, centerY, levelPaint)
        canvas.drawCircle(centerX, centerY, resources.displayMetrics.density * 4f, levelPaint)
        canvas.restore()
        val label = if (isLevel) context.getString(R.string.horizon_level)
        else String.format(Locale.US, "%+.1f°", rollDegrees)
        canvas.drawText(label, centerX, centerY - resources.displayMetrics.density * 14f, textPaint)
    }

    companion object {
        private const val LEVEL_TOLERANCE_DEGREES = 1f
    }
}
