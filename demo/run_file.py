from IPython.utils.io import Tee
from io import StringIO
from IPython.core.interactiveshell import InteractiveShell
shell = InteractiveShell.instance()
if shell is None:
    shell = InteractiveShell()

stdout=Tee(StringIO(), "w", channel="stdout")
stderr=Tee(StringIO(), "w", channel="stderr")

# result = shell.run_cell("""%run a.py""") # 直接run文件看不到错误信息
result = shell.run_cell("""import time;print(1);time.sleep(3);aaa=123;print(2);1/0""")

ret=[stdout.file.getvalue(),stderr.file.getvalue()]
stdout.close()
stderr.close()

print("=== 捕获的输出 ===")
print(ret[0])
print("=== 捕获的错误 ===")
print(ret[1])
print("执行结果 (result):", result.result)
print("执行成功:", result.success)
print("错误信息:", result.error_in_exec)

# 此文件通过 ipython 的 %run run_file.py 运行的话, 是能拿到 aaa 这个变量的