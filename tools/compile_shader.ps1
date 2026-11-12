$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
public static class DragonShaderCompiler {
    [ComImport, Guid("8BA5FB08-5195-40e2-AC58-0D989C3A0102"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface Blob { [PreserveSig] IntPtr GetBufferPointer(); [PreserveSig] UIntPtr GetBufferSize(); }
    [DllImport("d3dcompiler_47.dll", CallingConvention = CallingConvention.StdCall)]
    static extern int D3DCompile(byte[] data, UIntPtr size, string name, IntPtr defines, IntPtr include, string entry, string profile, uint flags, uint flags2, out Blob shader, out Blob errors);
    public static void Compile(string source, string output) {
        byte[] data = Encoding.UTF8.GetBytes(File.ReadAllText(source)); Blob shader, errors;
        int result = D3DCompile(data, (UIntPtr)data.Length, source, IntPtr.Zero, IntPtr.Zero, "main", "ps_3_0", 1 << 15, 0, out shader, out errors);
        try {
            if (result < 0) throw new Exception(errors == null ? "Shader compile failed" : Marshal.PtrToStringAnsi(errors.GetBufferPointer()));
            byte[] bytes = new byte[(int)shader.GetBufferSize().ToUInt64()]; Marshal.Copy(shader.GetBufferPointer(), bytes, 0, bytes.Length); File.WriteAllBytes(output, bytes);
        } finally { if (shader != null) Marshal.ReleaseComObject(shader); if (errors != null) Marshal.ReleaseComObject(errors); }
    }
}
'@
[DragonShaderCompiler]::Compile((Join-Path $PSScriptRoot '..\src\dragon.hlsl'), (Join-Path $PSScriptRoot '..\assets\dragon-v3\dragon.ps'))
Write-Output 'Dragon shader compiled'
