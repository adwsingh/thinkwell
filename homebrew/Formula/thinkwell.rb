class Thinkwell < Formula
  desc "AI agent orchestration framework"
  homepage "https://github.com/dherman/thinkwell"
  url "https://registry.npmjs.org/thinkwell/-/thinkwell-0.3.0-alpha.1.tgz"
  sha256 "e7dd03bdfcae32095e774bfa62074944a9313268dc7649e3391b5fd174fa5b85"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  def caveats
    <<~EOS
      thinkwell requires Bun to run scripts. Install Bun with:

        brew install oven-sh/bun/bun

      Or visit https://bun.sh for other installation options.
    EOS
  end

  test do
    assert_match "thinkwell", shell_output("#{bin}/thinkwell --version")
  end
end
