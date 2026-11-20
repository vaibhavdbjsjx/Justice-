import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import '../native/native_bridge.dart';
import '../theme/theme.dart';
import '../theme/tokens.g.dart';

/// Real-time 3D for moments of waiting and first impressions. Each scene is a
/// perspective stage of flat layers at different depths, so turning the stage a
/// few degrees gives true parallax: near layers travel further than far ones.
/// Everything is transforms, which keeps it smooth on every device. With Reduce
/// Motion on, scenes hold a still pose.

/// Feeds a scene its clock and how the device is being held.
class SceneDriver extends StatefulWidget {
  const SceneDriver({super.key, required this.builder, this.useMotion = true});

  /// [t] is seconds elapsed; [tilt] is smoothed device tilt, about -1 to 1.
  final Widget Function(BuildContext context, double t, Offset tilt) builder;
  final bool useMotion;

  @override
  State<SceneDriver> createState() => _SceneDriverState();
}

class _SceneDriverState extends State<SceneDriver> with SingleTickerProviderStateMixin {
  Ticker? _ticker;
  StreamSubscription<(double, double)>? _motion;
  double _t = 0;
  (double, double)? _baseline;
  Offset _target = Offset.zero;
  Offset _tilt = Offset.zero;
  bool _still = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final still = MediaQuery.disableAnimationsOf(context);
    if (still == _still && _ticker != null) return;
    _still = still;
    _ticker?.dispose();
    _ticker = null;
    _motion?.cancel();
    _motion = null;
    if (still) return;
    _ticker = createTicker(_onTick)..start();
    if (widget.useMotion) {
      _motion = NativeBridge.instance.motion.listen((reading) {
        final base = _baseline ??= reading;
        _target = Offset(
          ((reading.$2 - base.$2) * 1.6).clamp(-1.0, 1.0),
          ((reading.$1 - base.$1) * 1.6).clamp(-1.0, 1.0),
        );
      });
    }
  }

  void _onTick(Duration elapsed) {
    setState(() {
      _t = elapsed.inMicroseconds / 1e6;
      _tilt = Offset.lerp(_tilt, _target, 0.08)!;
    });
  }

  @override
  void dispose() {
    _ticker?.dispose();
    _motion?.cancel();
    super.dispose();
  }

  /// Scenes are illustrations, hidden from VoiceOver, so their few words keep the
  /// designed size instead of growing with the system text size and breaking
  /// the composition. Real content around them still scales.
  @override
  Widget build(BuildContext context) => MediaQuery.withNoTextScaling(
        child: Builder(builder: (context) => widget.builder(context, _t, _tilt)),
      );
}

class DepthLayer {
  const DepthLayer({required this.child, this.offset = Offset.zero, this.z = 0});
  final Widget child;
  final Offset offset;
  final double z;
}

/// Paints layers back to front through one shared perspective camera.
class DepthStage extends StatelessWidget {
  const DepthStage({
    super.key,
    required this.layers,
    this.rx = 0,
    this.ry = 0,
    this.perspective = 0.0011,
  });

  final List<DepthLayer> layers;
  final double rx;
  final double ry;
  final double perspective;

  @override
  Widget build(BuildContext context) {
    final ordered = [...layers]..sort((a, b) => a.z.compareTo(b.z));
    return Stack(
      alignment: Alignment.center,
      clipBehavior: Clip.none,
      children: [
        for (final layer in ordered)
          Transform(
            alignment: Alignment.center,
            transform: Matrix4.identity()
              ..setEntry(3, 2, perspective)
              ..rotateX(rx)
              ..rotateY(ry)
              ..translateByDouble(layer.offset.dx, layer.offset.dy, layer.z, 1),
            child: layer.child,
          ),
      ],
    );
  }
}

/// The Lexa balance mark.
class LexaMark extends StatelessWidget {
  const LexaMark({super.key, this.size = 28, this.color});

  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size.square(size),
      painter: _MarkPainter(color ?? context.accentColor),
    );
  }
}

class _MarkPainter extends CustomPainter {
  _MarkPainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width;
    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = s * 0.05;
    final thin = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = s * 0.03;
    final fill = Paint()..color = color;

    final c = s / 2;
    canvas.drawLine(Offset(c, s * 0.10), Offset(c, s * 0.82), stroke);
    canvas.drawCircle(Offset(c, s * 0.10), s * 0.055, fill);
    canvas.drawPath(
      Path()
        ..moveTo(c - s * 0.09, s * 0.82)
        ..lineTo(c + s * 0.09, s * 0.82)
        ..lineTo(c + s * 0.24, s * 0.91)
        ..lineTo(c - s * 0.24, s * 0.91)
        ..close(),
      fill,
    );
    final arm = s * 0.34;
    final beam = s * 0.20;
    canvas.drawLine(Offset(c - arm, beam), Offset(c + arm, beam), stroke);
    final pan = s * 0.56;
    final width = s * 0.15;
    for (final x in [c - arm, c + arm]) {
      canvas.drawLine(Offset(x, beam), Offset(x - width, pan), thin);
      canvas.drawLine(Offset(x, beam), Offset(x + width, pan), thin);
      canvas.drawArc(
        Rect.fromLTRB(x - width, pan - width * 0.55, x + width, pan + width * 0.9),
        0,
        math.pi,
        true,
        fill,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _MarkPainter old) => old.color != color;
}

/// An extruded coin bearing the mark, built from a stack of thin discs. It turns
/// through real depth, which is what sells it as an object.
class LexaCoin extends StatelessWidget {
  const LexaCoin({super.key, this.size = 72, this.spin = true});

  final double size;
  final bool spin;

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: size,
      child: SceneDriver(
        useMotion: false,
        builder: (context, t, _) => _Coin(size: size, angle: spin ? t * 1.25 : math.sin(t * 0.8) * 0.55),
      ),
    );
  }
}

class _Coin extends StatelessWidget {
  const _Coin({required this.size, required this.angle});

  final double size;
  final double angle;

  @override
  Widget build(BuildContext context) {
    const edgeLayers = 9;
    final depth = size * 0.11;
    final facing = math.cos(angle) >= 0;
    final faceColor = BrandTokens.brandOrange;
    final edge = HSLColor.fromColor(BrandTokens.brandOrangeDeep).withLightness(0.26).toColor();
    final shine = math.sin(angle * 2).abs();

    Widget disc(Color color) => Container(
          width: size,
          height: size,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        );

    final face = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment(-1 + shine, -1),
          end: Alignment(1 - shine, 1),
          colors: [
            Color.lerp(faceColor, Colors.white, 0.28)!,
            faceColor,
            BrandTokens.brandOrangeDeep,
          ],
        ),
      ),
      alignment: Alignment.center,
      child: LexaMark(size: size * 0.62, color: Colors.white),
    );

    return DepthStage(
      perspective: 0.0028 * (72 / size),
      rx: 0.16,
      ry: angle,
      layers: [
        for (var i = 0; i < edgeLayers; i++)
          DepthLayer(
            z: -depth / 2 + depth * i / (edgeLayers - 1),
            child: disc(edge),
          ),
        // Whichever face points at the viewer, the mark reads the right way round.
        DepthLayer(
          z: facing ? depth / 2 + 0.2 : -depth / 2 - 0.2,
          child: facing
              ? face
              : Transform(
                  alignment: Alignment.center,
                  transform: Matrix4.rotationY(math.pi),
                  child: face,
                ),
        ),
      ],
    );
  }
}

Widget _sceneCard(
  BuildContext context, {
  required double width,
  required Widget child,
  EdgeInsets padding = const EdgeInsets.all(14),
  double radius = 18,
}) {
  return Container(
    width: width,
    padding: padding,
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.surface,
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: Theme.of(context).colorScheme.outline),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withValues(alpha: context.isDark ? 0.42 : 0.1),
          blurRadius: 34,
          offset: const Offset(0, 18),
        ),
      ],
    ),
    child: child,
  );
}

class _Line extends StatelessWidget {
  const _Line({required this.widthFactor, this.color});

  final double widthFactor;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return FractionallySizedBox(
      alignment: Alignment.centerLeft,
      widthFactor: widthFactor,
      child: Container(
        height: 6,
        decoration: BoxDecoration(
          color: color ?? context.surfaceSunken,
          borderRadius: BorderRadius.circular(99),
        ),
      ),
    );
  }
}

/// The welcome scene: an answer, a document, and a deadline floating in depth.
class HeroStack extends StatelessWidget {
  const HeroStack({super.key, this.height = 320, this.scrollProgress = 0});

  final double height;

  /// 0 at rest, 1 once scrolled away. The stage leans back and lifts as it leaves.
  final double scrollProgress;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final unit = height / 320;

    return SizedBox(
      height: height,
      width: double.infinity,
      child: ExcludeSemantics(
        child: SceneDriver(
          builder: (context, t, tilt) {
            double float(double speed, double phase) => math.sin(t * speed + phase) * 7 * unit;
            final rx = 0.1 + math.sin(t * 0.45) * 0.035 - tilt.dy * 0.2 + scrollProgress * 0.3;
            final ry = -0.2 + math.cos(t * 0.38) * 0.05 + tilt.dx * 0.28;

            return Opacity(
              opacity: (1 - scrollProgress * 0.75).clamp(0.0, 1.0),
              child: Transform.translate(
                offset: Offset(0, -scrollProgress * 30),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Container(
                      width: height * 1.05,
                      height: height * 1.05,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(colors: [
                          BrandTokens.brandOrangeBright.withValues(alpha: context.isDark ? 0.24 : 0.17),
                          BrandTokens.brandOrangeBright.withValues(alpha: 0),
                        ]),
                      ),
                    ),
                    DepthStage(
                      rx: rx,
                      ry: ry,
                      layers: [
                        DepthLayer(
                          offset: Offset(-58 * unit, -46 * unit + float(0.9, 1.1)),
                          z: -90,
                          child: _sceneCard(
                            context,
                            width: 178 * unit,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Row(children: [
                                  Icon(Icons.description_outlined, size: 14 * unit, color: context.mutedColor),
                                  const SizedBox(width: 6),
                                  Expanded(child: _Line(widthFactor: 0.7, color: context.borderStrong)),
                                ]),
                                const SizedBox(height: 11),
                                const _Line(widthFactor: 1),
                                const SizedBox(height: 7),
                                const _Line(widthFactor: 0.84),
                                const SizedBox(height: 7),
                                _Line(widthFactor: 0.62, color: context.accentSoft),
                                const SizedBox(height: 7),
                                const _Line(widthFactor: 0.76),
                                const SizedBox(height: 7),
                                const _Line(widthFactor: 0.9),
                              ],
                            ),
                          ),
                        ),
                        DepthLayer(
                          offset: Offset(12 * unit, 12 * unit + float(0.8, 0)),
                          z: 20,
                          child: _sceneCard(
                            context,
                            width: 256 * unit,
                            radius: 22,
                            padding: EdgeInsets.all(16 * unit),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Row(children: [
                                  Container(
                                    width: 26 * unit,
                                    height: 26 * unit,
                                    decoration: BoxDecoration(color: context.accentSoft, shape: BoxShape.circle),
                                    alignment: Alignment.center,
                                    child: LexaMark(size: 16 * unit),
                                  ),
                                  const SizedBox(width: 8),
                                  Text('Lexa', style: theme.textTheme.labelMedium),
                                ]),
                                SizedBox(height: 10 * unit),
                                Text.rich(
                                  TextSpan(
                                    style: theme.textTheme.bodyMedium?.copyWith(fontSize: 13.5 * unit, height: 1.42),
                                    children: [
                                      const TextSpan(text: 'In California your landlord generally has '),
                                      TextSpan(
                                        text: '21 days',
                                        style: TextStyle(fontWeight: FontWeight.w600, color: theme.colorScheme.onSurface),
                                      ),
                                      const TextSpan(text: ' to return your deposit or itemize deductions.'),
                                    ],
                                  ),
                                ),
                                SizedBox(height: 10 * unit),
                                Row(children: [
                                  Icon(Icons.verified_outlined, size: 13 * unit, color: context.successColor),
                                  const SizedBox(width: 5),
                                  Flexible(
                                    child: Text(
                                      'Civil Code § 1950.5',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: theme.textTheme.labelSmall?.copyWith(color: context.successColor, letterSpacing: 0),
                                    ),
                                  ),
                                ]),
                              ],
                            ),
                          ),
                        ),
                        DepthLayer(
                          offset: Offset(-88 * unit, -112 * unit + float(1.0, 2.2)),
                          z: 70,
                          child: _sceneCard(
                            context,
                            width: 136 * unit,
                            radius: 99,
                            padding: EdgeInsets.symmetric(horizontal: 12 * unit, vertical: 8 * unit),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.place_outlined, size: 14 * unit, color: context.accentColor),
                                const SizedBox(width: 5),
                                Flexible(
                                  child: Text(
                                    'California, US',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: theme.textTheme.labelSmall?.copyWith(
                                      color: theme.colorScheme.onSurface,
                                      letterSpacing: 0,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        DepthLayer(
                          offset: Offset(104 * unit, 150 * unit + float(1.15, 0.6)),
                          z: 130,
                          child: Container(
                            width: 122 * unit,
                            padding: EdgeInsets.all(13 * unit),
                            decoration: BoxDecoration(
                              color: BrandTokens.brandOrange,
                              borderRadius: BorderRadius.circular(17),
                              boxShadow: [
                                BoxShadow(
                                  color: BrandTokens.brandOrange.withValues(alpha: 0.45),
                                  blurRadius: 30,
                                  offset: const Offset(0, 16),
                                ),
                              ],
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Row(children: [
                                  Icon(Icons.schedule_rounded, size: 12 * unit, color: Colors.white70),
                                  const SizedBox(width: 4),
                                  Text('Deadline', style: theme.textTheme.labelSmall?.copyWith(color: Colors.white70, letterSpacing: 0)),
                                ]),
                                const SizedBox(height: 3),
                                Text(
                                  '21 days',
                                  style: TextStyle(
                                    fontFamily: 'Inter',
                                    fontSize: 21 * unit,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: -0.5,
                                    color: Colors.white,
                                  ),
                                ),
                                Text('after move-out', style: theme.textTheme.labelSmall?.copyWith(color: Colors.white70, letterSpacing: 0)),
                              ],
                            ),
                          ),
                        ),
                        DepthLayer(
                          offset: Offset(112 * unit, -86 * unit + float(0.7, 3.4)),
                          z: 96,
                          child: _FloatingCoin(size: 50 * unit, angle: math.sin(t * 0.7) * 0.5),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _FloatingCoin extends StatelessWidget {
  const _FloatingCoin({required this.size, required this.angle});
  final double size;
  final double angle;

  @override
  Widget build(BuildContext context) => SizedBox.square(
        dimension: size,
        child: _Coin(size: size, angle: angle),
      );
}

/// Shown while a document is read: a page in depth with a light sweeping over it,
/// clauses lighting up as it passes, and findings lifting toward the viewer.
class DocumentScanScene extends StatelessWidget {
  const DocumentScanScene({super.key, this.size = 300});

  final double size;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final pageWidth = size * 0.62;
    final pageHeight = size * 0.82;
    const lineCount = 12;

    return SizedBox(
      height: size,
      width: double.infinity,
      child: ExcludeSemantics(
        child: SceneDriver(
          builder: (context, t, tilt) {
            final sweep = (t % 3.4) / 3.4;
            final eased = Curves.easeInOut.transform(sweep);
            final surface = theme.colorScheme.surface;

            Widget page({Color? color}) => Container(
                  width: pageWidth,
                  height: pageHeight,
                  decoration: BoxDecoration(
                    color: color ?? surface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: theme.colorScheme.outline),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: context.isDark ? 0.4 : 0.09),
                        blurRadius: 30,
                        offset: const Offset(0, 16),
                      ),
                    ],
                  ),
                );

            final topPage = ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: SizedBox(
                width: pageWidth,
                height: pageHeight,
                child: Stack(
                  children: [
                    Positioned.fill(child: page()),
                    Padding(
                      padding: EdgeInsets.all(pageWidth * 0.09),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          for (var i = 0; i < lineCount; i++) ...[
                            _ScanLine(
                              widthFactor: const <double>[0.55, 1, 0.92, 0.78, 1, 0.66, 0.95, 0.84, 1, 0.72, 0.9, 0.5][i],
                              lit: eased > (i + 0.5) / lineCount,
                              flagged: i == 4 || i == 8,
                            ),
                            SizedBox(height: pageHeight * 0.034),
                          ],
                        ],
                      ),
                    ),
                    Positioned(
                      left: 0,
                      right: 0,
                      top: pageHeight * eased - 34,
                      height: 68,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              BrandTokens.brandOrangeBright.withValues(alpha: 0),
                              BrandTokens.brandOrangeBright.withValues(alpha: 0.28),
                              BrandTokens.brandOrangeBright.withValues(alpha: 0),
                            ],
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      left: 0,
                      right: 0,
                      top: pageHeight * eased,
                      height: 2,
                      child: ColoredBox(color: BrandTokens.brandOrangeBright),
                    ),
                  ],
                ),
              ),
            );

            double bob(double speed, double phase) => math.sin(t * speed + phase) * 6;

            return DepthStage(
              rx: 0.28 + math.sin(t * 0.5) * 0.03 - tilt.dy * 0.15,
              ry: -0.32 + math.cos(t * 0.42) * 0.07 + tilt.dx * 0.25,
              layers: [
                DepthLayer(z: -56, offset: const Offset(-16, -12), child: page(color: context.surfaceRaised)),
                DepthLayer(z: -28, offset: const Offset(-8, -6), child: page()),
                DepthLayer(z: 0, child: topPage),
                DepthLayer(
                  z: 74,
                  offset: Offset(pageWidth * 0.52, -pageHeight * 0.2 + bob(1.1, 0)),
                  child: _FindingChip(icon: Icons.assignment_turned_in_outlined, label: 'Obligations', visible: sweep > 0.2),
                ),
                DepthLayer(
                  z: 104,
                  offset: Offset(-pageWidth * 0.5, pageHeight * 0.06 + bob(0.95, 1.4)),
                  child: _FindingChip(icon: Icons.flag_outlined, label: 'Risky clauses', visible: sweep > 0.45, emphasized: true),
                ),
                DepthLayer(
                  z: 84,
                  offset: Offset(pageWidth * 0.46, pageHeight * 0.32 + bob(1.25, 2.6)),
                  child: _FindingChip(icon: Icons.event_outlined, label: 'Key dates', visible: sweep > 0.68),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _ScanLine extends StatelessWidget {
  const _ScanLine({required this.widthFactor, required this.lit, required this.flagged});

  final double widthFactor;
  final bool lit;
  final bool flagged;

  @override
  Widget build(BuildContext context) {
    final idle = context.surfaceSunken;
    final color = !lit
        ? idle
        : flagged
            ? BrandTokens.brandOrangeBright.withValues(alpha: 0.75)
            : context.borderStrong;
    return FractionallySizedBox(
      widthFactor: widthFactor,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        height: 6,
        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(99)),
      ),
    );
  }
}

class _FindingChip extends StatelessWidget {
  const _FindingChip({
    required this.icon,
    required this.label,
    required this.visible,
    this.emphasized = false,
  });

  final IconData icon;
  final String label;
  final bool visible;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final foreground = emphasized ? Colors.white : theme.colorScheme.onSurface;
    return AnimatedOpacity(
      duration: LexaMotion.base,
      opacity: visible ? 1 : 0,
      child: AnimatedScale(
        duration: LexaMotion.slow,
        curve: LexaMotion.curve,
        scale: visible ? 1 : 0.8,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
          decoration: BoxDecoration(
            color: emphasized ? BrandTokens.brandOrange : theme.colorScheme.surface,
            borderRadius: BorderRadius.circular(99),
            border: emphasized ? null : Border.all(color: theme.colorScheme.outline),
            boxShadow: [
              BoxShadow(
                color: (emphasized ? BrandTokens.brandOrange : Colors.black)
                    .withValues(alpha: emphasized ? 0.4 : (context.isDark ? 0.4 : 0.12)),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 14, color: emphasized ? Colors.white : context.accentColor),
              const SizedBox(width: 5),
              Text(label, style: theme.textTheme.labelSmall?.copyWith(color: foreground, letterSpacing: 0)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Shown while a draft is written: lines of a page set themselves in depth.
class DraftingScene extends StatelessWidget {
  const DraftingScene({super.key, this.size = 280});

  final double size;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final width = size * 0.66;
    final height = size * 0.84;
    const widths = <double>[0.5, 0, 1, 0.94, 0.86, 1, 0.42, 0, 0.92, 1, 0.74, 0, 0.36];

    return SizedBox(
      height: size,
      width: double.infinity,
      child: ExcludeSemantics(
        child: SceneDriver(
          builder: (context, t, tilt) {
            final progress = (t % 5) / 4.2;
            return DepthStage(
              rx: 0.22 + math.sin(t * 0.55) * 0.03 - tilt.dy * 0.15,
              ry: 0.3 + math.cos(t * 0.4) * 0.06 + tilt.dx * 0.25,
              layers: [
                DepthLayer(
                  z: -30,
                  offset: const Offset(10, -8),
                  child: Container(
                    width: width,
                    height: height,
                    decoration: BoxDecoration(
                      color: context.surfaceRaised,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: theme.colorScheme.outline),
                    ),
                  ),
                ),
                DepthLayer(
                  child: Container(
                    width: width,
                    height: height,
                    padding: EdgeInsets.all(width * 0.1),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.surface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: theme.colorScheme.outline),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: context.isDark ? 0.42 : 0.1),
                          blurRadius: 34,
                          offset: const Offset(0, 18),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (var i = 0; i < widths.length; i++) ...[
                          _DraftLine(
                            target: widths[i],
                            fill: ((progress * widths.length) - i).clamp(0.0, 1.0),
                          ),
                          SizedBox(height: height * 0.028),
                        ],
                      ],
                    ),
                  ),
                ),
                DepthLayer(
                  z: 90,
                  offset: Offset(width * 0.42, height * 0.36 + math.sin(t * 1.1) * 6),
                  child: const _FloatingCoin(size: 54, angle: 0.3),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _DraftLine extends StatelessWidget {
  const _DraftLine({required this.target, required this.fill});

  final double target;
  final double fill;

  @override
  Widget build(BuildContext context) {
    if (target == 0) return const SizedBox(height: 4);
    return FractionallySizedBox(
      alignment: Alignment.centerLeft,
      widthFactor: (target * fill).clamp(0.001, 1.0),
      child: Container(
        height: 6,
        decoration: BoxDecoration(color: context.borderStrong, borderRadius: BorderRadius.circular(99)),
      ),
    );
  }
}

/// Deadline reminders as they arrive: Lexa notifications stacked in depth, the
/// way a week-before, day-before, and morning-of reminder build up.
class ReminderScene extends StatelessWidget {
  const ReminderScene({super.key, this.height = 250});

  final double height;

  @override
  Widget build(BuildContext context) {
    final unit = height / 250;
    return SizedBox(
      height: height,
      width: double.infinity,
      child: ExcludeSemantics(
        child: SceneDriver(
          builder: (context, t, tilt) {
            double bob(double speed, double phase) => math.sin(t * speed + phase) * 4 * unit;
            return DepthStage(
              rx: 0.2 + math.sin(t * 0.5) * 0.025 - tilt.dy * 0.15,
              ry: -0.16 + math.cos(t * 0.42) * 0.05 + tilt.dx * 0.22,
              layers: [
                DepthLayer(
                  z: -80,
                  offset: Offset(0, -60 * unit + bob(0.8, 2.1)),
                  child: _NotificationCard(
                    width: 268 * unit,
                    when: 'Nov 1',
                    title: 'Due in a week',
                    body: 'Send written demand to landlord',
                    faded: true,
                  ),
                ),
                DepthLayer(
                  z: -10,
                  offset: Offset(0, -2 * unit + bob(0.9, 1.0)),
                  child: _NotificationCard(
                    width: 286 * unit,
                    when: 'Yesterday',
                    title: 'Due tomorrow',
                    body: 'Send written demand to landlord · Deposit dispute',
                  ),
                ),
                DepthLayer(
                  z: 70,
                  offset: Offset(0, 58 * unit + bob(1.05, 0)),
                  child: _NotificationCard(
                    width: 304 * unit,
                    when: '9:00 AM',
                    title: 'Due today',
                    body: 'Send written demand to landlord · Deposit dispute',
                    urgent: true,
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({
    required this.width,
    required this.when,
    required this.title,
    required this.body,
    this.urgent = false,
    this.faded = false,
  });

  final double width;
  final String when;
  final String title;
  final String body;
  final bool urgent;
  final bool faded;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Opacity(
      opacity: faded ? 0.75 : 1,
      child: Container(
        width: width,
        padding: const EdgeInsets.fromLTRB(12, 11, 14, 12),
        decoration: BoxDecoration(
          color: theme.colorScheme.surface.withValues(alpha: 0.96),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: theme.colorScheme.outline),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: context.isDark ? 0.45 : 0.12),
              blurRadius: 30,
              offset: const Offset(0, 16),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: BrandTokens.brandOrange,
                borderRadius: BorderRadius.circular(9),
              ),
              alignment: Alignment.center,
              child: const LexaMark(size: 22, color: Colors.white),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.titleSmall?.copyWith(
                            color: urgent ? context.alertColor : null,
                          ),
                        ),
                      ),
                      Text(when, style: theme.textTheme.bodySmall?.copyWith(fontSize: 11.5)),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    body,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall?.copyWith(color: context.mutedStrong, height: 1.3),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The assistant at work: a turning coin with what it's currently doing.
class ThinkingRow extends StatefulWidget {
  const ThinkingRow({super.key, required this.webSearch});

  final bool webSearch;

  @override
  State<ThinkingRow> createState() => _ThinkingRowState();
}

class _ThinkingRowState extends State<ThinkingRow> {
  late final List<String> _stages = [
    'Reading your question',
    if (widget.webSearch) 'Checking official sources',
    'Applying your jurisdiction',
    'Writing it in plain language',
  ];
  int _stage = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(milliseconds: 2400), (_) {
      if (_stage < _stages.length - 1) setState(() => _stage++);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      label: _stages[_stage],
      child: Row(
        children: [
          const LexaCoin(size: 34),
          const SizedBox(width: 12),
          Expanded(
            child: AnimatedSwitcher(
              duration: LexaMotion.base,
              switchInCurve: LexaMotion.curve,
              transitionBuilder: (child, animation) => FadeTransition(
                opacity: animation,
                child: SlideTransition(
                  position: Tween(begin: const Offset(0, 0.3), end: Offset.zero).animate(animation),
                  child: child,
                ),
              ),
              layoutBuilder: (current, previous) => Stack(
                alignment: Alignment.centerLeft,
                children: [...previous, ?current],
              ),
              child: Text(
                _stages[_stage],
                key: ValueKey(_stage),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: context.mutedColor),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
