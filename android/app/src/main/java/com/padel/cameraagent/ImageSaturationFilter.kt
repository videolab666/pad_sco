package com.padel.cameraagent

import android.content.Context
import android.opengl.GLES20
import android.opengl.Matrix
import android.os.Build
import androidx.annotation.RequiresApi
import com.pedro.encoder.R
import com.pedro.encoder.input.gl.render.filters.BaseFilterRender
import com.pedro.encoder.utils.gl.GlUtil
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Чистый фильтр насыщенности (image-quality 2026-09-03): замена сломанному
 * SaturationFilterRender RootEncoder'а — его шейдер при значениях <= 0 держит
 * exponents нулевыми и ДОБАВЛЯЕТ pow(x,0)=1/max(...) к кадру (пересвет),
 * а при > 0 использует сырое значение как blend-фактор (почти ч/б).
 *
 * Семантика здесь: 1f = нейтрально, 0f = ч/б, 2f = двойная насыщенность.
 * Формула: mix(luma, color, k) — классика без сюрпризов.
 */
@RequiresApi(api = Build.VERSION_CODES.JELLY_BEAN_MR2)
class ImageSaturationFilter : BaseFilterRender() {

    private val squareVertexDataFilter = floatArrayOf(
        // X, Y, Z, U, V
        -1f, -1f, 0f, 0f, 0f, // bottom left
        1f, -1f, 0f, 1f, 0f, // bottom right
        -1f, 1f, 0f, 0f, 1f, // top left
        1f, 1f, 0f, 1f, 1f, // top right
    )

    private var program = -1
    private var aPositionHandle = -1
    private var aTextureHandle = -1
    private var uMVPMatrixHandle = -1
    private var uSTMatrixHandle = -1
    private var uSamplerHandle = -1
    private var uSaturationHandle = -1

    private var saturation = 1f

    init {
        squareVertex = ByteBuffer.allocateDirect(squareVertexDataFilter.size * FLOAT_SIZE_BYTES)
            .order(ByteOrder.nativeOrder())
            .asFloatBuffer()
        squareVertex.put(squareVertexDataFilter).position(0)
        Matrix.setIdentityM(MVPMatrix, 0)
        Matrix.setIdentityM(STMatrix, 0)
    }

    override fun initGlFilter(context: Context) {
        val vertexShader = GlUtil.getStringFromRaw(context, R.raw.simple_vertex)
        val fragmentShader = """
            precision mediump float;
            uniform sampler2D uSampler;
            uniform float uSaturation;
            varying vec2 vTextureCoord;
            void main() {
              vec4 color = texture2D(uSampler, vTextureCoord);
              float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
              gl_FragColor = vec4(mix(vec3(luma), color.rgb, uSaturation), color.a);
            }
        """.trimIndent()

        program = GlUtil.createProgram(vertexShader, fragmentShader)
        aPositionHandle = GLES20.glGetAttribLocation(program, "aPosition")
        aTextureHandle = GLES20.glGetAttribLocation(program, "aTextureCoord")
        uMVPMatrixHandle = GLES20.glGetUniformLocation(program, "uMVPMatrix")
        uSTMatrixHandle = GLES20.glGetUniformLocation(program, "uSTMatrix")
        uSamplerHandle = GLES20.glGetUniformLocation(program, "uSampler")
        uSaturationHandle = GLES20.glGetUniformLocation(program, "uSaturation")
    }

    override fun drawFilter() {
        GLES20.glUseProgram(program)

        squareVertex.position(SQUARE_VERTEX_DATA_POS_OFFSET)
        GLES20.glVertexAttribPointer(
            aPositionHandle, 3, GLES20.GL_FLOAT, false,
            SQUARE_VERTEX_DATA_STRIDE_BYTES, squareVertex,
        )
        GLES20.glEnableVertexAttribArray(aPositionHandle)

        squareVertex.position(SQUARE_VERTEX_DATA_UV_OFFSET)
        GLES20.glVertexAttribPointer(
            aTextureHandle, 2, GLES20.GL_FLOAT, false,
            SQUARE_VERTEX_DATA_STRIDE_BYTES, squareVertex,
        )
        GLES20.glEnableVertexAttribArray(aTextureHandle)

        GLES20.glUniformMatrix4fv(uMVPMatrixHandle, 1, false, MVPMatrix, 0)
        GLES20.glUniformMatrix4fv(uSTMatrixHandle, 1, false, STMatrix, 0)
        GLES20.glUniform1f(uSaturationHandle, saturation)

        GLES20.glUniform1i(uSamplerHandle, 0)
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, previousTexId)
    }

    override fun disableResources() {
        GlUtil.disableResources(aTextureHandle, aPositionHandle)
    }

    override fun release() {
        GLES20.glDeleteProgram(program)
    }

    /** @param saturation 1f = нейтрально, 0f = ч/б, 2f = двойная насыщенность. */
    fun setSaturation(saturation: Float) {
        this.saturation = saturation
    }
}
