# web_llama_cpp
首先，你要开一个服务器，用llama-server，端口可以随便设置，建议设置为1145

然后改config.js

**建议使用linux/termux做服务端，必须编译服务端并运行,AI的路径必须是服务端（比如树莓派）的~/model/model.gguf**

完成后打开服务端，在打开一个终端，运行
```sh
python -m http.server 8000
```

恭喜！🎉 大功告成！
