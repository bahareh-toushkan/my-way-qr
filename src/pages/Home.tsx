// 소개 페이지
export default function Home() {
  return (
    <div className="home">
      <header>
        <div className="home-badge">2026 AI 라이프 솔루션 챌린지 · 아이디어 5번 구현 시제품</div>
        <h1>
          내 방식 QR <span>— 키오스크를 내 휴대폰에서, 내 방식으로</span>
        </h1>
        <p className="lead">
          키오스크 화면의 QR을 찍으면, AI가 그 키오스크 화면을 <b>내가 설정한 방식</b>(큰 글씨·큰 버튼·쉬운 말·단계 설명·읽어 주기·고대비·다른 언어)으로 <b>실시간</b> 다시 만들어 내 휴대폰에 보여 줍니다. 휴대폰에서 누른
          버튼은 원래 키오스크 주문 시스템으로 그대로 전달됩니다.
        </p>
      </header>

      <div className="home-actions">
        <a className="cta" href="/kiosk">
          ☕ 시연용 키오스크 열기 (카페)
        </a>
        <a className="cta alt" href="/kiosk?store=restaurant">
          🍚 시연용 키오스크 열기 (식당)
        </a>
        <a className="cta ghost" href="/eval">
          📊 변환 성공률 측정
        </a>
      </div>
      <p className="hint">노트북에서 키오스크를 열고, 휴대폰 카메라로 화면의 QR을 찍어 보세요.</p>

      <section className="how">
        <h2>작동 방식</h2>
        <ol>
          <li>
            <b>키오스크 SDK</b>가 지금 화면의 구조(메뉴·옵션·버튼)를 데이터로 내보냅니다.
          </li>
          <li>
            휴대폰의 <b>'내 방식' 설정</b>은 휴대폰에만 저장되고, 변환할 때 설정값만 함께 보냅니다. 이름·장애 정보는 받지 않습니다.
          </li>
          <li>
            <b>AI(Google Gemini)</b>가 화면 구조 + 설정으로 새 화면을 만듭니다. 버튼 값은 원래 화면의 버튼으로만 고를 수 있게 묶어 둡니다(제약 출력).
          </li>
          <li>
            <b>검증기</b>가 버튼 1:1 대응, 가격·알레르기 정보 임의 작성 여부, 출력 언어, 화면 규칙을 검사합니다. 통과하지 못하면 문제를 알려 주고 한 번 더 만들고, 그래도 안 되면{' '}
            <b>규칙 기반 간단 화면</b>과 직원 호출로 대체합니다.
          </li>
          <li>휴대폰에서 누른 버튼은 원래 버튼 값 그대로 모의 주문 서버에 전달되어, 키오스크 화면도 함께 바뀝니다.</li>
        </ol>
      </section>

      <section className="how">
        <h2>밝혀 두는 것</h2>
        <ul>
          <li>매장·메뉴·가격·알레르기 정보는 시연용 예시입니다. 결제는 모의 결제이며 실제 돈이 나가지 않습니다.</li>
          <li>화면 변환과 '말로 설정하기'에는 Google Gemini API를 사용합니다. 가격·알레르기 정보는 AI가 쓰지 않고 매장 데이터에서 그대로 표시합니다.</li>
          <li>성공률·시간 같은 수치는 측정 페이지에서 실제로 측정한 값만 사용합니다.</li>
        </ul>
      </section>
      <footer>© 2026 Bahareh Toushkan · 서울대학교 컴퓨터공학부</footer>
    </div>
  );
}
